import { Linking, Platform } from 'react-native';

interface Location {
    lat: number;
    lng: number;
}

interface NavigationData {
    addressLabel?: string;
    location?: Location | null;
}

export const buildGoogleMapsUrl = ({ addressLabel, location }: NavigationData): string => {
    if (location) {
        return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    }
    if (addressLabel) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`;
    }
    return '';
};

export const buildWazeUrls = ({ addressLabel, location }: NavigationData): { appUrl?: string; webUrl: string } => {
    if (location) {
        const coords = `${location.lat},${location.lng}`;
        return {
            appUrl: `waze://?ll=${coords}&navigate=yes`,
            webUrl: `https://waze.com/ul?ll=${coords}&navigate=yes`
        };
    }
    if (addressLabel) {
        const encoded = encodeURIComponent(addressLabel);
        return {
            webUrl: `https://waze.com/ul?q=${encoded}&navigate=yes`
        };
    }
    return { webUrl: '' };
};

export const openWaze = async (data: NavigationData): Promise<void> => {
    const { appUrl, webUrl } = buildWazeUrls(data);

    if (Platform.OS === 'web') {
        if (webUrl) {
            await Linking.openURL(webUrl);
        }
        return;
    }

    if (appUrl) {
        try {
            const canOpen = await Linking.canOpenURL(appUrl);
            if (canOpen) {
                await Linking.openURL(appUrl);
                return;
            }
        } catch (error) {
            console.warn('Waze app not available, falling back to web', error);
        }
    }

    if (webUrl) {
        await Linking.openURL(webUrl);
    }
};
