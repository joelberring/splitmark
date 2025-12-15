/**
 * SportIdent Hardware Integration
 * Web Serial API for reading SI cards
 */

// Web Serial API type declarations (not included in standard TypeScript types)
declare global {
    interface Navigator {
        serial: Serial;
    }
    interface Serial {
        requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
        getPorts(): Promise<SerialPort[]>;
    }
    interface SerialPortRequestOptions {
        filters?: { usbVendorId?: number; usbProductId?: number }[];
    }
    interface SerialPort {
        open(options: SerialOptions): Promise<void>;
        close(): Promise<void>;
        readable: ReadableStream<Uint8Array> | null;
        writable: WritableStream<Uint8Array> | null;
    }
    interface SerialOptions {
        baudRate: number;
        dataBits?: number;
        stopBits?: number;
        parity?: 'none' | 'even' | 'odd';
        flowControl?: 'none' | 'hardware';
    }
}

import type { SIPunch } from '@/types/database';

export interface SICard {
    cardNumber: string;
    startTime?: Date;
    finishTime?: Date;
    checkTime?: Date;
    punches: SIPunch[];
    cardType: 'SI5' | 'SI6' | 'SI8' | 'SI9' | 'SI10' | 'SI11' | 'SIAC' | 'Unknown';
}

export interface SIStation {
    port: SerialPort;
    stationCode?: string;
    mode: 'read' | 'control' | 'start' | 'finish';
}

/**
 * SportIdent Reader using Web Serial API
 */
export class SportIdentReader {
    private port: SerialPort | null = null;
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    private connected: boolean = false;

    /**
     * Check if Web Serial API is supported
     */
    static isSupported(): boolean {
        return 'serial' in navigator;
    }

    /**
     * Request connection to SportIdent station
     */
    async connect(): Promise<void> {
        if (!SportIdentReader.isSupported()) {
            throw new Error('Web Serial API stöds inte i denna webbläsare. Använd Chrome eller Edge.');
        }

        try {
            // Request port with Silicon Labs USB-to-UART filter
            this.port = await navigator.serial.requestPort({
                filters: [
                    { usbVendorId: 0x10c4 }, // Silicon Labs
                ],
            });

            // Open port with SI settings: 38400 baud, 8 data bits, 1 stop bit, no parity
            await this.port.open({
                baudRate: 38400,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none',
            });

            this.reader = this.port.readable?.getReader() || null;
            this.writer = this.port.writable?.getWriter() || null;
            this.connected = true;

            // Send wakeup command
            await this.wakeup();
        } catch (error: any) {
            throw new Error(`Kunde inte ansluta till SportIdent-station: ${error.message}`);
        }
    }

    /**
     * Disconnect from station
     */
    async disconnect(): Promise<void> {
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
            this.reader = null;
        }

        if (this.writer) {
            await this.writer.close();
            this.writer = null;
        }

        if (this.port) {
            await this.port.close();
            this.port = null;
        }

        this.connected = false;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Read SI card
     * Returns when a card is detected and read
     */
    async readCard(): Promise<SICard> {
        if (!this.connected || !this.reader) {
            throw new Error('Inte ansluten till SportIdent-station');
        }

        try {
            // Wait for card insertion
            const data = await this.waitForData();

            // Parse SI card data
            return this.parseCardData(data);
        } catch (error: any) {
            throw new Error(`Misslyckades att läsa SI-bricka: ${error.message}`);
        }
    }

    /**
     * Listen for card reads (continuous)
     */
    async *watchCards(): AsyncGenerator<SICard> {
        if (!this.connected || !this.reader) {
            throw new Error('Inte ansluten till SportIdent-station');
        }

        while (this.connected) {
            try {
                const card = await this.readCard();
                yield card;
            } catch (error) {
                console.error('Card read error:', error);
            }
        }
    }

    /**
     * Send wakeup command to station
     */
    private async wakeup(): Promise<void> {
        if (!this.writer) return;

        const wakeupCmd = new Uint8Array([0xFF]); // Wakeup byte
        await this.writer.write(wakeupCmd);

        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Wait for data from serial port
     */
    private async waitForData(): Promise<Uint8Array> {
        if (!this.reader) {
            throw new Error('Reader not initialized');
        }

        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        while (true) {
            const { value, done } = await this.reader.read();

            if (done) {
                break;
            }

            if (value) {
                chunks.push(value);
                totalLength += value.length;

                // Check if we have a complete packet
                if (this.isCompletePacket(chunks)) {
                    break;
                }
            }
        }

        // Concatenate chunks
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    /**
     * Check if we have a complete SI packet
     */
    private isCompletePacket(chunks: Uint8Array[]): boolean {
        if (chunks.length === 0) return false;

        const firstChunk = chunks[0];

        // SI packets start with STX (0x02) and end with ETX (0x03)
        if (firstChunk[0] !== 0x02) return false;

        const lastChunk = chunks[chunks.length - 1];
        return lastChunk[lastChunk.length - 1] === 0x03;
    }

    /**
     * Parse SI card data from raw bytes
     */
    private parseCardData(data: Uint8Array): SICard {
        // Verify packet structure
        if (data[0] !== 0x02 || data[data.length - 1] !== 0x03) {
            throw new Error('Ogiltigt SI-paket');
        }

        // Parse packet
        const cmd = data[1];
        const len = data[2];
        const payload = data.slice(3, 3 + len);
        const crc = (data[3 + len] << 8) | data[4 + len];

        // Verify CRC
        const calculatedCRC = this.calculateCRC(data.slice(1, 3 + len));
        if (crc !== calculatedCRC) {
            throw new Error('CRC-fel: korrupt data');
        }

        // Determine card type and parse
        const cardNumber = this.parseCardNumber(payload);
        const cardType = this.detectCardType(cmd, cardNumber);

        // Parse timestamps and punches based on card type
        const punches: SIPunch[] = [];
        let startTime: Date | undefined;
        let finishTime: Date | undefined;

        // TODO: Implement full parsing for different card types
        // For now, return basic structure

        return {
            cardNumber,
            cardType,
            punches,
            startTime,
            finishTime,
        };
    }

    /**
     * Parse card number from payload
     */
    private parseCardNumber(payload: Uint8Array): string {
        // Card number is typically in first 2-4 bytes
        // SI5: 2 bytes, SI6-11: 3-4 bytes
        if (payload.length >= 4) {
            const num = (payload[0] << 16) | (payload[1] << 8) | payload[2];
            return num.toString();
        } else if (payload.length >= 2) {
            const num = (payload[0] << 8) | payload[1];
            return num.toString();
        }

        return 'Unknown';
    }

    /**
     * Detect SI card type
     */
    private detectCardType(cmd: number, cardNumber: string): SICard['cardType'] {
        const num = parseInt(cardNumber);

        // SI card number ranges
        if (num >= 1 && num <= 65535) return 'SI5';
        if (num >= 500000 && num <= 999999) return 'SI6';
        if (num >= 1000000 && num <= 1999999) return 'SI8';
        if (num >= 2000000 && num <= 2999999) return 'SI9';
        if (num >= 6000000 && num <= 6999999) return 'SI10';
        if (num >= 7000000 && num <= 7999999) return 'SI11';
        if (num >= 9000000 && num <= 9999999) return 'SIAC';

        return 'Unknown';
    }

    /**
     * Calculate CRC checksum
     */
    private calculateCRC(data: Uint8Array): number {
        let crc = 0;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i] << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x8005;
                } else {
                    crc = crc << 1;
                }
            }
        }
        return crc & 0xFFFF;
    }
}

// Export singleton instance
export const sportIdentReader = new SportIdentReader();
