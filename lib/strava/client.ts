/**
 * Strava API Integration
 * OAuth and activity sync
 */

export interface StravaConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface StravaAthlete {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    profile: string;
}

export interface StravaActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    start_date: string;
}

export class StravaClient {
    private config: StravaConfig;
    private accessToken: string | null = null;

    constructor(config?: StravaConfig) {
        this.config = config || {
            clientId: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '',
            clientSecret: process.env.NEXT_PUBLIC_STRAVA_CLIENT_SECRET || '',
            redirectUri: process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI || 'http://localhost:3000/strava/callback',
        };
    }

    /**
     * Get Strava OAuth URL
     */
    getAuthorizationUrl(scope: string = 'activity:write'): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope,
        });

        return `https://www.strava.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeToken(code: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: number;
        athlete: StravaAthlete;
    }> {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
                grant_type: 'authorization_code',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to exchange token');
        }

        const data = await response.json();
        this.accessToken = data.access_token;

        return data;
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: number;
    }> {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        this.accessToken = data.access_token;

        return data;
    }

    /**
     * Set access token manually
     */
    setAccessToken(token: string): void {
        this.accessToken = token;
    }

    /**
     * Upload activity to Strava
     */
    async uploadActivity(params: {
        name: string;
        type: 'Run' | 'Hike' | 'Walk';
        start_date_local: string;
        elapsed_time: number;
        description?: string;
        distance?: number;
        trainer?: boolean;
        commute?: boolean;
    }): Promise<StravaActivity> {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const response = await fetch('https://www.strava.com/api/v3/activities', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error('Failed to upload activity');
        }

        return await response.json();
    }

    /**
     * Upload GPX file to Strava
     */
    async uploadGPX(file: File, params: {
        name: string;
        type: 'Run' | 'Hike' | 'Walk';
        description?: string;
        trainer?: boolean;
        commute?: boolean;
        data_type?: 'gpx' | 'fit' | 'tcx';
    }): Promise<{ id: number; activity_id: number }> {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', params.name);
        formData.append('type', params.type);
        formData.append('data_type', params.data_type || 'gpx');

        if (params.description) {
            formData.append('description', params.description);
        }
        if (params.trainer !== undefined) {
            formData.append('trainer', params.trainer.toString());
        }
        if (params.commute !== undefined) {
            formData.append('commute', params.commute.toString());
        }

        const response = await fetch('https://www.strava.com/api/v3/uploads', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to upload GPX');
        }

        return await response.json();
    }

    /**
     * Get athlete's activities
     */
    async getActivities(page: number = 1, per_page: number = 30): Promise<StravaActivity[]> {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const params = new URLSearchParams({
            page: page.toString(),
            per_page: per_page.toString(),
        });

        const response = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch activities');
        }

        return await response.json();
    }

    /**
     * Get current athlete
     */
    async getAthlete(): Promise<StravaAthlete> {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const response = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch athlete');
        }

        return await response.json();
    }
}

// Export singleton
export const stravaClient = new StravaClient();
