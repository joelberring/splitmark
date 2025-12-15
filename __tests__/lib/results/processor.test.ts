import { resultsProcessor } from '@/lib/results/processor';

describe('Results Processor', () => {
    describe('Time Formatting', () => {
        it('should format seconds as MM:SS', () => {
            expect(resultsProcessor.formatTime(65)).toBe('1:05');
            expect(resultsProcessor.formatTime(125)).toBe('2:05');
            expect(resultsProcessor.formatTime(3665)).toBe('61:05');
        });

        it('should handle single digits', () => {
            expect(resultsProcessor.formatTime(5)).toBe('0:05');
            expect(resultsProcessor.formatTime(59)).toBe('0:59');
        });
    });

    describe('Time Difference', () => {
        it('should format positive differences', () => {
            expect(resultsProcessor.formatTimeDiff(30)).toBe('+0:30');
            expect(resultsProcessor.formatTimeDiff(125)).toBe('+2:05');
        });

        it('should format negative differences', () => {
            expect(resultsProcessor.formatTimeDiff(-30)).toBe('-0:30');
            expect(resultsProcessor.formatTimeDiff(-125)).toBe('-2:05');
        });
    });

    describe('Results Ranking', () => {
        it('should sort results by time', () => {
            const results = [
                { status: 'OK', time: 125, person: { name: { family: 'B' } } },
                { status: 'OK', time: 100, person: { name: { family: 'A' } } },
                { status: 'MissingPunch', person: { name: { family: 'C' } } },
            ] as any[];

            const sorted = resultsProcessor.generateResultsList(results, 'time');

            expect(sorted[0].time).toBe(100);
            expect(sorted[1].time).toBe(125);
            expect(sorted[2].status).toBe('MissingPunch');
        });
    });
});
