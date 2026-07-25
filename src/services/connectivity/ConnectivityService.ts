import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface ConnectivityState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: NetInfoState['type'];
}

function mapState(state: NetInfoState): ConnectivityState {
  return {
    isConnected: state.isConnected === true,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
  };
}

export class ConnectivityService {
  public async getCurrentState(): Promise<ConnectivityState> {
    return mapState(await NetInfo.fetch());
  }

  public subscribe(listener: (state: ConnectivityState) => void): () => void {
    return NetInfo.addEventListener((state) => listener(mapState(state)));
  }
}

export const connectivityService = new ConnectivityService();
