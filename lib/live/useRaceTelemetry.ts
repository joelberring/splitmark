'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Use environment variable for WebSocket URL, fallback to localhost for dev
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

export interface TelemetryPacket {
    lat: number;
    lon: number;
    timestamp: number;
    runner_id: string;
    race_id: string;
    // Extended fields
    elevation?: number;
    heart_rate?: number;
    speed?: number;
}

export function useRaceTelemetry(raceId: string, enabled: boolean = true) {
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const [latestPackets, setLatestPackets] = useState<Record<string, TelemetryPacket>>({});

    // Keep track of accumulated packets for history/tails if needed by other components
    // But for performance, we might want to let the visualizer handle history buffering

    // Callback to be registered by consumers
    const onPacketRef = useRef<((packet: TelemetryPacket) => void) | null>(null);

    const connect = useCallback(() => {
        if (!enabled || !raceId) return;

        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setStatus('connecting');
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('Connected to Telemetry Gateway');
            setStatus('connected');
            // Send subscription message if protocol requires it
            // ws.send(JSON.stringify({ type: 'subscribe', raceId }));
        };

        ws.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data) as TelemetryPacket;

                // Filter by raceId if receiving global feed (simple check)
                if (packet.race_id && packet.race_id !== raceId) return;

                // Update state
                setLatestPackets(prev => ({
                    ...prev,
                    [packet.runner_id]: packet
                }));

                // Notify subscribers
                if (onPacketRef.current) {
                    onPacketRef.current(packet);
                }
            } catch (e) {
                console.error('Failed to parse telemetry packet', e);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from Telemetry Gateway');
            setStatus('disconnected');
            wsRef.current = null;
            // Simple reconnect logic
            setTimeout(connect, 3000);
        };

        ws.onerror = (e) => {
            console.error('WebSocket error', e);
            setStatus('error');
        };

        wsRef.current = ws;
    }, [raceId, enabled]);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const setPacketHandler = (handler: (packet: TelemetryPacket) => void) => {
        onPacketRef.current = handler;
    };

    return {
        status,
        latestPackets,
        setPacketHandler
    };
}
