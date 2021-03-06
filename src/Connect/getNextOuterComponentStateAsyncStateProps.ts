import { CommandExecutor } from '../CommandExecutor'
import { AsyncSelectorResults, AsyncSelectorResult } from '../Select/AsyncSelectorResult'
import { keys, head } from '../utils'
import { getCommands } from '../AsyncValue'
import { someHasChanged } from '../Select/Tracked'
import { none } from '../None'
import { ASYNC_VALUE_RECEIVED } from '../const'

enum NextCommandType {
  NoCommand,
  CommandAvailable
}

type NoCommand = Readonly<{ type: NextCommandType.NoCommand }>
type CommandAvailable<Command> = Readonly<{ type: NextCommandType.CommandAvailable; command: Command }>

type NextCommand<Command> = NoCommand | CommandAvailable<Command>

function getNextCommand<AppState, OwnProps, Command, O>(asyncSelectorResults: AsyncSelectorResults<AppState, OwnProps, Command, O>): NextCommand<Command> {
  const keyIterator = keys(asyncSelectorResults)[Symbol.iterator]()
  let nextKey = keyIterator.next()
  while (!nextKey.done) {
    const nextValue = asyncSelectorResults[nextKey.value]
    const commandsFromNextValue = getCommands(nextValue.asyncValue)
    const firstCommandFromNextValue = head(commandsFromNextValue)
    if (firstCommandFromNextValue !== none) {
      return { type: NextCommandType.CommandAvailable, command: firstCommandFromNextValue.value }
    }
    nextKey = keyIterator.next()
  }
  return { type: NextCommandType.NoCommand }
}

function getNextProperty<AppState, OwnProps, Command, Value>(
  prevState: AsyncSelectorResult<AppState, OwnProps, Command, Value>,
  state: AsyncSelectorResult<AppState, OwnProps, Command, Value>,
  appState: AppState,
  ownProps: OwnProps
): AsyncSelectorResult<AppState, OwnProps, Command, Value> {
  if (state.asyncValue.type === ASYNC_VALUE_RECEIVED) {
    // When we have a new value, let's choose to present
    // that to the component. If we don't have a previous
    // value at all, we have nothing else to present to
    // the component.
    return state
  } else if (someHasChanged(prevState.trackedUserInput, appState, ownProps)) {
    // If we don't have a value at all, we need to decide
    // whether to present the old value to the component
    // or present a `None` (which might trigger a loader).
    // We will only do this when the user input change.
    return state
  } else {
    // Otherwise, we're dealing with a background refresh
    // and would like to work with the previous value while
    // we have that available.
    return prevState
  }
}

export function getNextOuterComponentStateAsyncStateProps<AppState, Command, O, OwnProps>(
  commandExecutor: CommandExecutor<Command>,
  getAppState: () => AppState,
  ownProps: OwnProps,
  mapStateToAsyncProps: (appState: AppState, ownProps: OwnProps) => AsyncSelectorResults<AppState, OwnProps, Command, O>,
  prevState: AsyncSelectorResults<AppState, OwnProps, Command, O>
): AsyncSelectorResults<AppState, OwnProps, Command, O> {
  // First, execute all commands available.
  let appState = getAppState()
  let asyncSelectorResults = mapStateToAsyncProps(appState, ownProps)
  let nextCommand = getNextCommand(asyncSelectorResults)
  while (nextCommand.type !== NextCommandType.NoCommand) {
    if (nextCommand.type === NextCommandType.CommandAvailable) {
      commandExecutor(nextCommand.command)
    }

    appState = getAppState()
    asyncSelectorResults = mapStateToAsyncProps(appState, ownProps)
    nextCommand = getNextCommand(asyncSelectorResults)
  }

  // Then, determine the next state, based on the previous state.
  const nextState: Partial<AsyncSelectorResults<AppState, OwnProps, Command, O>> = {}
  keys(asyncSelectorResults).forEach(key => {
    nextState[key] = getNextProperty(prevState[key], asyncSelectorResults[key], appState, ownProps)
  })
  return nextState as AsyncSelectorResults<AppState, OwnProps, Command, O>
}
