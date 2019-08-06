import { NonePartial } from '../None'
import { AsyncSelectorResults } from '../Select/AsyncSelectorResult'
import { FetchCommand, createFetchCommandExecutor } from '../FetchCommand'
import { connectAsyncWithCommand } from './connectAsyncWithCommand'
import * as Redux from 'redux'

export const connectAsync = <AppState, OwnProps extends object, AsyncStateProps, SyncStateProps, DispatchProps>(
  mapStateToAsyncStateProps: (appState: AppState, ownProps: OwnProps) => AsyncSelectorResults<AppState, OwnProps, FetchCommand, AsyncStateProps>,
  mapStateToSyncStateProps: (appState: AppState, ownProps: OwnProps) => SyncStateProps,
  mapDispatchToProps: (dispatch: Redux.Dispatch<Redux.Action>) => DispatchProps
) => (Component: React.ComponentType<NonePartial<AsyncStateProps> & SyncStateProps & DispatchProps>) => {
  return connectAsyncWithCommand(mapStateToAsyncStateProps, mapStateToSyncStateProps, mapDispatchToProps, createFetchCommandExecutor)(Component)
}
