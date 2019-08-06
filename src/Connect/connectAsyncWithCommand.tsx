import * as React from 'react'
import * as ReactRedux from 'react-redux'
import * as Redux from 'redux'
import { NonePartial } from '../None'
import { AsyncSelectorResults } from '../Select/AsyncSelectorResult'
import { CommandExecutor } from '../CommandExecutor'
import { getInnerComponentProps } from './getInnerComponentProps'
import { OuterComponentState } from './OuterComponentState'
import { createAppStateSubscriber } from './createAppStateSubscriber'
import { memoize } from '../utils'
import { objectsAreEqual, Equality } from '../Equality'

export const connectAsyncWithCommand = <AppState, AsyncStateProps, SyncStateProps, DispatchProps, OwnProps extends object, Command>(
  mapStateToAsyncStateProps: (appState: AppState, ownProps: OwnProps) => AsyncSelectorResults<AppState, OwnProps, Command, AsyncStateProps>,
  mapStateToSyncStateProps: (appState: AppState, ownProps: OwnProps) => SyncStateProps,
  mapDispatchToProps: (dispatch: Redux.Dispatch<Redux.Action>) => DispatchProps,
  createCommandExecutor: (dispatch: Redux.Dispatch<Redux.Action>, getState: () => AppState) => CommandExecutor<Command>
) => (Component: React.ComponentType<NonePartial<AsyncStateProps> & SyncStateProps & DispatchProps>): React.ComponentType<OwnProps> => {
  type OuterComponentProps = Readonly<{
    store: Redux.Store<AppState, Redux.AnyAction>
    ownProps: OwnProps
  }>

  class OuterComponent extends React.Component<OuterComponentProps, OuterComponentState<AppState, OwnProps, Command, AsyncStateProps, SyncStateProps>> {
    private subscriber: () => void = () => {}
    private unsubscribeToStore: Redux.Unsubscribe = (): void => undefined
    private readonly dispatchProps: DispatchProps
    private readonly commandExecutor: CommandExecutor<Command>
    private ownPropsAreEqual: Equality<OwnProps> = memoize(objectsAreEqual)
    private statesAreEqual: Equality<OuterComponentState<AppState, OwnProps, Command, AsyncStateProps, SyncStateProps>> = memoize(objectsAreEqual)

    constructor(props: OuterComponentProps) {
      super(props)
      const initialAppState: AppState = props.store.getState()
      this.dispatchProps = mapDispatchToProps(props.store.dispatch)
      this.state = {
        asyncStateProps: mapStateToAsyncStateProps(initialAppState, props.ownProps),
        syncStateProps: mapStateToSyncStateProps(initialAppState, props.ownProps)
      }
      this.commandExecutor = createCommandExecutor(props.store.dispatch, props.store.getState)
    }

    private subscribeToStore() {
      this.unsubscribeToStore()
      this.subscriber = createAppStateSubscriber(
        mapStateToAsyncStateProps,
        mapStateToSyncStateProps,
        this.commandExecutor,
        this.props.store.getState,
        () => this.props.ownProps,
        () => this.state,
        state => this.setState(state)
      )
      this.unsubscribeToStore = this.props.store.subscribe(this.subscriber)
      this.subscriber()
    }

    public componentDidMount() {
      this.subscribeToStore()
    }

    public componentWillUnmount() {
      this.unsubscribeToStore()
    }

    public shouldComponentUpdate(nextProps: OuterComponentProps, nextState: OuterComponentState<AppState, OwnProps, Command, AsyncStateProps, SyncStateProps>) {
      return !this.statesAreEqual(this.state, nextState) || !this.ownPropsAreEqual(this.props.ownProps, nextProps.ownProps)
    }

    public render() {
      return React.createElement<NonePartial<AsyncStateProps> & SyncStateProps & DispatchProps>(
        Component,
        getInnerComponentProps(this.state.asyncStateProps, this.state.syncStateProps, this.dispatchProps)
      )
    }

    public componentDidUpdate(prevProps: OuterComponentProps) {
      if (!this.ownPropsAreEqual(prevProps.ownProps, this.props.ownProps)) {
        this.subscriber()
      }
    }
  }

  return (ownProps: OwnProps) => (
    <ReactRedux.ReactReduxContext.Consumer>{({ store }) => <OuterComponent ownProps={ownProps} store={store} />}</ReactRedux.ReactReduxContext.Consumer>
  )
}
