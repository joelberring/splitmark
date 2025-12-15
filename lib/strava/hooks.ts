/**
 * Strava Hooks
 * React hooks for Strava authentication state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { stravaClient } from './client';

export interface StravaAthlete {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    profile: string;
}

export interface StravaAuthState {
    isConnected: boolean;
    athlete: StravaAthlete | null;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to check Strava connection status
 */
export function useStravaAuth(): StravaAuthState & {
    connect: () => void;
    disconnect: () => void;
    refreshTokenIfNeeded: () => Promise<boolean>;
} {
    const [state, setState] = useState<StravaAuthState>({
        isConnected: false,
        athlete: null,
        loading: true,
        error: null,
    });

    // Check stored tokens on mount
    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = () => {
        try {
            const accessToken = localStorage.getItem('strava_access_token');
            const athleteJson = localStorage.getItem('strava_athlete');
            const expiresAt = localStorage.getItem('strava_expires_at');

            if (accessToken && athleteJson) {
                const athlete = JSON.parse(athleteJson) as StravaAthlete;

                // Check if token is expired
                if (expiresAt && parseInt(expiresAt) * 1000 < Date.now()) {
                    // Token expired, try to refresh
                    refreshTokenIfNeeded().then((success) => {
                        if (!success) {
                            setState({
                                isConnected: false,
                                athlete: null,
                                loading: false,
                                error: 'Token expired',
                            });
                        }
                    });
                    return;
                }

                stravaClient.setAccessToken(accessToken);
                setState({
                    isConnected: true,
                    athlete,
                    loading: false,
                    error: null,
                });
            } else {
                setState({
                    isConnected: false,
                    athlete: null,
                    loading: false,
                    error: null,
                });
            }
        } catch (error) {
            setState({
                isConnected: false,
                athlete: null,
                loading: false,
                error: 'Failed to check connection',
            });
        }
    };

    const connect = useCallback(() => {
        const url = stravaClient.getAuthorizationUrl('read,activity:write,activity:read_all');
        window.location.href = url;
    }, []);

    const disconnect = useCallback(() => {
        localStorage.removeItem('strava_access_token');
        localStorage.removeItem('strava_refresh_token');
        localStorage.removeItem('strava_expires_at');
        localStorage.removeItem('strava_athlete');
        stravaClient.setAccessToken('');
        setState({
            isConnected: false,
            athlete: null,
            loading: false,
            error: null,
        });
    }, []);

    const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
        const refreshToken = localStorage.getItem('strava_refresh_token');
        const expiresAt = localStorage.getItem('strava_expires_at');

        if (!refreshToken) return false;

        // Only refresh if expired or expiring soon (within 10 mins)
        if (expiresAt && parseInt(expiresAt) * 1000 > Date.now() + 600000) {
            return true; // Token still valid
        }

        try {
            const data = await stravaClient.refreshToken(refreshToken);
            localStorage.setItem('strava_access_token', data.access_token);
            localStorage.setItem('strava_refresh_token', data.refresh_token);
            localStorage.setItem('strava_expires_at', data.expires_at.toString());
            stravaClient.setAccessToken(data.access_token);

            setState((prev) => ({
                ...prev,
                isConnected: true,
                error: null,
            }));

            return true;
        } catch (error) {
            console.error('Failed to refresh Strava token:', error);
            return false;
        }
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        refreshTokenIfNeeded,
    };
}

/**
 * Upload a track to Strava
 */
export async function uploadTrackToStrava(
    gpxContent: string,
    name: string,
    description?: string
): Promise<{ success: boolean; activityId?: number; error?: string }> {
    // Check token
    const accessToken = localStorage.getItem('strava_access_token');
    if (!accessToken) {
        return { success: false, error: 'Not connected to Strava' };
    }

    stravaClient.setAccessToken(accessToken);

    try {
        // Create GPX file
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const file = new File([blob], `${name}.gpx`, { type: 'application/gpx+xml' });

        const result = await stravaClient.uploadGPX(file, {
            name,
            type: 'Run',
            description,
            data_type: 'gpx',
        });

        return { success: true, activityId: result.activity_id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
        };
    }
}
