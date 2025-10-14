import fs from 'fs';
import { DealHistory } from '../types';

export class DeduplicationService {
    private historyFilePath: string;
    private maxAgeInDays: number;

    constructor(historyFilePath: string = './deal-history.json', maxAgeInDays: number = 7) {
        this.historyFilePath = historyFilePath;
        this.maxAgeInDays = maxAgeInDays;
    }

    private loadHistory(): DealHistory {
        try {
            if (fs.existsSync(this.historyFilePath)) {
                const data = fs.readFileSync(this.historyFilePath, 'utf-8');
                return JSON.parse(data) as DealHistory;
            }
        } catch (error) {
            console.error('Error loading deal history:', error);
        }

        return {
            postedDeals: {},
            lastRotation: Date.now()
        };
    }

    private saveHistory(history: DealHistory): void {
        try {
            fs.writeFileSync(
                this.historyFilePath,
                JSON.stringify(history, null, 2),
                'utf-8'
            );
            console.log(`Saved deal history with ${Object.keys(history.postedDeals).length} deals`);
        } catch (error) {
            console.error('Error saving deal history:', error);
        }
    }

    private shouldRotate(history: DealHistory): boolean {
        const daysSinceRotation = (Date.now() - history.lastRotation) / (1000 * 60 * 60 * 24);
        return daysSinceRotation >= this.maxAgeInDays;
    }

    private rotateHistory(history: DealHistory): DealHistory {
        console.log('Rotating deal history...');

        const cutoffTime = Date.now() - (this.maxAgeInDays * 24 * 60 * 60 * 1000);
        const newPostedDeals: Record<string, number> = {};

        for (const [dealID, timestamp] of Object.entries(history.postedDeals)) {
            if (timestamp > cutoffTime) {
                newPostedDeals[dealID] = timestamp;
            }
        }

        console.log(`Removed ${Object.keys(history.postedDeals).length - Object.keys(newPostedDeals).length} old deals`);

        return {
            postedDeals: newPostedDeals,
            lastRotation: Date.now()
        };
    }

    isDealPosted(dealID: string): boolean {
        const history = this.loadHistory();
        return dealID in history.postedDeals;
    }

    markDealAsPosted(dealID: string): void {
        let history = this.loadHistory();

        if (this.shouldRotate(history)) {
            history = this.rotateHistory(history);
        }

        history.postedDeals[dealID] = Date.now();
        this.saveHistory(history);
    }

    filterNewDeals<T extends { dealID: string }>(deals: T[]): T[] {
        const history = this.loadHistory();

        if (this.shouldRotate(history)) {
            const rotatedHistory = this.rotateHistory(history);
            this.saveHistory(rotatedHistory);
            return deals.filter(deal => !(deal.dealID in rotatedHistory.postedDeals));
        }

        return deals.filter(deal => !(deal.dealID in history.postedDeals));
    }

    markDealsAsPosted<T extends { dealID: string }>(deals: T[]): void {
        let history = this.loadHistory();

        if (this.shouldRotate(history)) {
            history = this.rotateHistory(history);
        }

        const now = Date.now();
        deals.forEach(deal => {
            history.postedDeals[deal.dealID] = now;
        });

        this.saveHistory(history);
    }

    getStats(): { totalDeals: number; oldestDeal: number | null } {
        const history = this.loadHistory();
        const timestamps = Object.values(history.postedDeals);

        return {
            totalDeals: timestamps.length,
            oldestDeal: timestamps.length > 0 ? Math.min(...timestamps) : null
        };
    }

    clearHistory(): void {
        const emptyHistory: DealHistory = {
            postedDeals: {},
            lastRotation: Date.now()
        };
        this.saveHistory(emptyHistory);
        console.log('Deal history cleared');
    }
}