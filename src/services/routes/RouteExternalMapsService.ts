import { Linking, Platform } from 'react-native';

import type { RouteCoordinate } from '@/types/route';

function encodedDestination(coordinate: RouteCoordinate): string {
  return `${coordinate.latitude},${coordinate.longitude}`;
}

export class RouteExternalMapsService {
  public async openAppleMaps(coordinate: RouteCoordinate): Promise<void> {
    const destination = encodeURIComponent(encodedDestination(coordinate));
    const nativeUrl = `http://maps.apple.com/?daddr=${destination}`;
    const webUrl = `https://maps.apple.com/?daddr=${destination}`;
    await this.openWithFallback(nativeUrl, webUrl);
  }

  public async openGoogleMaps(coordinate: RouteCoordinate): Promise<void> {
    const destination = encodeURIComponent(encodedDestination(coordinate));
    const nativeUrl = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    await this.openWithFallback(nativeUrl, webUrl);
  }

  private async openWithFallback(nativeUrl: string, webUrl: string): Promise<void> {
    if (Platform.OS !== 'web' && (await Linking.canOpenURL(nativeUrl))) {
      await Linking.openURL(nativeUrl);
      return;
    }
    await Linking.openURL(webUrl);
  }
}

export const routeExternalMapsService = new RouteExternalMapsService();
