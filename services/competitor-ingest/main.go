package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()
var rdb *redis.Client

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

type GPSPoint struct {
	Lat       float64 `json:"lat"`
	Lon       float64 `json:"lon"`
	Timestamp int64   `json:"timestamp"`
	RunnerID  string  `json:"runner_id"`
	RaceID    string  `json:"race_id"`
}

func initRedis() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	rdb = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Printf("Warning: Could not connect to Redis at %s: %v", redisAddr, err)
	} else {
		log.Printf("Connected to Redis at %s", redisAddr)
	}
}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		
		var point GPSPoint
		err = json.Unmarshal(message, &point)
		if err != nil {
			log.Printf("Error decoding JSON: %v", err)
			continue
		}
		
		// In a real scenario, valid authentication here
		
		// 1. Publish to Live Channel
		channel := "race:LIVE:" + point.RaceID
		err = rdb.Publish(ctx, channel, message).Err()
		if err != nil {
			log.Printf("Redis Publish error: %v", err)
		}

		// 2. Add to Geo Stream/List for buffering (Simplified)
		// rdb.GeoAdd(...)
		// rdb.LPush(...)
	}
}

func main() {
	initRedis()

	http.HandleFunc("/ws", handleConnection)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Competitor-Ingest listening on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
