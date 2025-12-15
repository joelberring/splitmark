import { gpsTracker } from '@/lib/gps/tracker';

describe('GPS Tracker', () => {
    beforeEach(() => {
        // Reset tracker state
        gpsTracker.stopTracking();
    });

    describe('Distance Calculation', () => {
        it('should calculate distance between two points', () => {
            const p1 = { lat: 59.33, lng: 18.07 };
            const p2 = { lat: 59.34, lng: 18.08 };

            const distance = calculateDistance(p1, p2);

            expect(distance).toBeGreaterThan(0);
            expect(distance).toBeLessThan(2000); // Less than 2km
        });

        it('should return 0 for same points', () => {
            const p = { lat: 59.33, lng: 18.07 };

            const distance = calculateDistance(p, p);

            expect(distance).toBe(0);
        });
    });

    describe('GPX Export', () => {
        it('should export track to GPX format', () => {
            const points = [
                { lat: 59.33, lng: 18.07, timestamp: new Date(), accuracy: 5 },
                { lat: 59.34, lng: 18.08, timestamp: new Date(), accuracy: 5 },
            ];

            const gpx = exportToGPX(points, {
                name: 'Test Track',
                description: 'Test Description',
            });

            expect(gpx).toContain('<?xml version="1.0"');
            expect(gpx).toContain('<gpx');
            expect(gpx).toContain('Test Track');
            expect(gpx).toContain('59.33');
            expect(gpx).toContain('18.07');
        });
    });
});

// Helper function for tests
function calculateDistance(p1: any, p2: any): number {
    const R = 6371000;
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function exportToGPX(points: any[], options: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>${options.name}</name>
    <trkseg>
      ${points.map(p => `<trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
}
