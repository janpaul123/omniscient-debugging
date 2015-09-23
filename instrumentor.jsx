const React = require('react/addons');
const { indexOf, uniqueId, where } = require('underscore');
const chroma = require('chroma-js/chroma');

const { PropTypes } = React;
const { PureRenderMixin } = React.addons;

/**
 * Experiment in omniscient debugging.
 * (See http://janpaulposma.nl/visualising-program-execution/ for background)
 *
 * Everything is deliberately kept in this file (plus some stuff in
 * webpack.config.js and instrument_wrapper.js out of necessity) to not
 * clutter the code base with this experimental work, and to make trying out
 * new things a little easier.
 *
 * Since this is experimental, it is all a little hacky, and that's okay.
 * The goal is to try out some visualisations that help with debugging,
 * understanding, and creating code in real life, instead of keeping omniscient
 * debugging an academic exercise.
 *
 * Enable by setting the environment variable OMNISCIENT=true.
 */

function stringToColor(string, opacity=1) {
  let number = 0;
  for (let i = 0; i < string.length; i++) {
    number += string.charCodeAt(i) % 26;
  }
  return chroma.hcl(number, 100, 85).alpha(opacity).css();
}

const InstrumentorCodeEvent = React.createClass({
  // propTypes: {
  //   background: PropTypes.string,
  //   endLine: PropTypes.number.isRequired,
  //   leftPosition: PropTypes.number.isRequired,
  //   localEventIndex: PropTypes.number.isRequired,
  //   onLocalEventIndexChange: PropTypes.func.isRequired,
  //   onLocalEventClick: PropTypes.func.isRequired,
  //   startLine: PropTypes.number.isRequired,
  // },

  mixins: [
    PureRenderMixin,
  ],

  _handleOnMouseEnter() {
    this.props.onLocalEventIndexChange(this.props.localEventIndex);
  },

  _handleOnMouseLeave() {
    this.props.onLocalEventIndexChange(null);
  },

  _handleOnClick() {
    this.props.onLocalEventClick(this.props.localEventIndex);
  },

  render() {
    return (
      <div
        style={{
          width: 3,
          height: 15 * (this.props.endLine - this.props.startLine + 1),
          position: 'absolute',
          left: this.props.leftPosition,
          top: 15 * this.props.startLine,
          background: this.props.background,
        }}
        onClick={this._handleOnClick}
        onMouseEnter={this._handleOnMouseEnter}
        onMouseLeave={this._handleOnMouseLeave}
      />
    );
  },
});

const InstrumentorCodeEvents = React.createClass({
  // propTypes: {
  //   activeEventIndex: PropTypes.number.isRequired,
  //   eventsInSnippet: PropTypes.array.isRequired,
  //   localEventIndex: PropTypes.number,
  //   onSelectLocked: PropTypes.func.isRequired,
  //   onLocalEventIndexChange: PropTypes.func.isRequired,
  // },

  mixins: [
    PureRenderMixin,
  ],

  componentDidUpdate() {
    this._scrollToActiveEvent();
  },

  _scrollToActiveEvent() {
    if (this.refs.events && this.refs.activeEvent) {
      const eventsElement = React.findDOMNode(this.refs.events);
      const activeEventElement = React.findDOMNode(this.refs.activeEvent);

      eventsElement.scrollLeft =
        activeEventElement.offsetLeft - eventsElement.clientWidth / 2;
    }
  },

  _handleLocalEventClick(localEventIndex) {
    this.props.onSelectLocked(
      this.props.eventsInSnippet[localEventIndex].index);
  },

  render() {
    // TODO: add some pagination or so
    const EVENTS_SHOWN = 400;
    const localEventIndexOfActiveEvent = indexOf(this.props.eventsInSnippet
      .map(event => event.index), this.props.activeEventIndex, true);
    const firstLocalEventIndex =
      Math.max(0, localEventIndexOfActiveEvent - (500 / 2));
    const displayedEvents = this.props.eventsInSnippet
      .slice(firstLocalEventIndex, firstLocalEventIndex + 500);

    let eventLeftPosition = 500;

    return (
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          overflowX: 'scroll' }}
        ref='events'
      >
        {displayedEvents.map((event, displayedEventIndex) => {
          const localEventIndex = displayedEventIndex + firstLocalEventIndex;

          eventLeftPosition += 3;

          const nextEvent = this.props.eventsInSnippet[localEventIndex + 1];
          if (nextEvent && nextEvent.index > event.index + 1) {
            eventLeftPosition += 3 +
              Math.max(12, Math.round((nextEvent.index - event.index) / 1000));
          }

          let background = 'rgba(0,0,0,0.07)';
          if (localEventIndex === this.props.localEventIndex) {
            background = 'yellow';
          } else if (event.index === this.props.activeEventIndex) {
            background = 'orange';
          }

          return (
            <InstrumentorCodeEvent
              background={background}
              endLine={event.endLine}
              key={event.index}
              leftPosition={eventLeftPosition}
              localEventIndex={localEventIndex}
              onLocalEventClick={this._handleLocalEventClick}
              onLocalEventIndexChange={this.props.onLocalEventIndexChange}
              ref={event.index === this.props.activeEventIndex && 'activeEvent'}
              startLine={event.startLine}
            />
          );
        })}
      </div>
    );
  },
});

const InstrumentorCode = React.createClass({
  // propTypes: {
  //   snippetSplitByLines: PropTypes.array.isRequired,
  //   activeEvent: PropTypes.shape({
  //     annotations: PropTypes.string,
  //     snippetName: PropTypes.string.isRequired,
  //     index: PropTypes.number.isRequired,
  //     startLine: PropTypes.number.isRequired,
  //     startColumn: PropTypes.number.isRequired,
  //     endLine: PropTypes.number.isRequired,
  //     endColumn: PropTypes.number.isRequired,
  //   }).isRequired,
  //   activeEventInCode: PropTypes.shape({
  //     annotations: PropTypes.string,
  //     snippetName: PropTypes.string.isRequired,
  //     index: PropTypes.number.isRequired,
  //     startLine: PropTypes.number.isRequired,
  //     startColumn: PropTypes.number.isRequired,
  //     endLine: PropTypes.number.isRequired,
  //     endColumn: PropTypes.number.isRequired,
  //   }),
  //   eventsInSnippet: PropTypes.array.isRequired,
  //   onSelectActiveInCode: PropTypes.func.isRequired,
  //   onSelectLocked: PropTypes.func.isRequired,
  // },

  mixins: [
    PureRenderMixin,
  ],

  componentDidMount() {
    this._scrollToFirstLine();

    this._columnWidth = React.findDOMNode(
      this.refs.hiddenMeasuringDiv).clientWidth / 100;
    // Refresh after first mount since we didn't have _columnWidth yet.
    setTimeout(() => this.forceUpdate());
  },

  componentDidUpdate(prevProps) {
    if (prevProps.snippetSplitByLines !== this.props.snippetSplitByLines ||
        prevProps.activeEvent.index !== this.props.activeEvent.index) {
      this._scrollToFirstLine();
    }
  },

  _handleLocalEventIndexChange(localIndex) {
    if (localIndex !== null) {
      this.props.onSelectActiveInCode(
        this.props.eventsInSnippet[localIndex].index);
    } else {
      this.props.onSelectActiveInCode(null);
    }
  },

  _scrollToFirstLine() {
    if (this.refs.file && this.refs.firstLine) {
      const fileElement = React.findDOMNode(this.refs.file);
      const firstLineElement = React.findDOMNode(this.refs.firstLine);

      fileElement.scrollTop =
        firstLineElement.offsetTop - fileElement.clientHeight / 2;
    }
  },

  _renderHighlights(color, { startLine, startColumn, endLine, endColumn }) {
    if (!this.refs.hiddenMeasuringDiv) {
      return null;
    }

    const highlights = [];

    for (let line = startLine; line <= endLine; line++) {
      const fullLineLength = this.props.snippetSplitByLines[line].length;
      let left = 0;

      if (line === startLine) {
        left = this._columnWidth * startColumn;
      }

      let width = this._columnWidth * fullLineLength - left;

      if (line === endLine) {
        width = this._columnWidth * endColumn - left;
      }

      highlights.push(
        <div
          key={line}
          style={{
            position: 'absolute',
            top: 15 * line,
            height: 15,
            left, width,
            background: color,
          }}
        />
      );
    }
    return <div style={{ opacity: 0.5 }}>{highlights}</div>;
  },

  render() {
    return (
      <div
        style={{ height: '100%', display: 'flex', flexDirection: 'column',
          minHeight: '0.01px' }}
      >
        <div
          style={{
            position: 'absolute',
            fontFamily: 'monospace',
            fontSize: 10,
            whiteSpace: 'nowrap',
            lineHeight: '15px',
            height: 15,
            visibility: 'hidden',
          }}
          ref='hiddenMeasuringDiv'
        >
          {new Array(100 + 1).join('a')}
        </div>
        <div
          style={{
            lineHeight: 1.5,
            borderBottom: '2px solid ' +
              stringToColor(this.props.activeEvent.snippetName),
          }}
        >
          {this.props.activeEvent.snippetName}
        </div>
        <div style={{ height: '100%', overflowY: 'scroll' }} ref='file'>
          <div style={{ position: 'relative' }}>
            {this.props.activeEventInCode &&
              this._renderHighlights('yellow', this.props.activeEventInCode)}
            {this._renderHighlights('orange', this.props.activeEvent)}
            {this.props.snippetSplitByLines.map((code, line) =>
              <div
                key={line}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  whiteSpace: 'pre',
                  lineHeight: '15px',
                  height: 15,
                  position: 'relative', // on top of highlights
                }}
                ref={line === this.props.activeEvent.startLine && 'firstLine'}
              >
                {code}
                {line === this.props.activeEvent.startLine &&
                  this.props.activeEvent.annotations &&
                    ' // ' + this.props.activeEvent.annotations}
              </div>
            )}
            <InstrumentorCodeEvents
              activeEventIndex={this.props.activeEvent.index}
              eventsInSnippet={this.props.eventsInSnippet}
              localEventIndex={this.props.activeEventInCode &&
                indexOf(this.props.eventsInSnippet.map(event => event.index),
                  this.props.activeEventInCode.index, true)}
              onLocalEventIndexChange={this._handleLocalEventIndexChange}
              onSelectLocked={this.props.onSelectLocked}
            />
          </div>
        </div>
      </div>
    );
  },
});

const InstrumentorStackedMapPoint = React.createClass({
  // propTypes: {
  //   activeEventInCodeIndex: PropTypes.number,
  //   eventIndex: PropTypes.number.isRequired,
  //   fullLog: PropTypes.object.isRequired,
  //   onSelectActive: PropTypes.func.isRequired,
  //   searchFilter: PropTypes.string.isRequired,
  //   lockedEventIndex: PropTypes.number,
  // },

  getInitialState() {
    return {
      expanded: false,
      moreLinkHovering: false,
    };
  },

  componentWillMount() {
    this._expandIfLockedEventIndexIsBelowThis(this.props.lockedEventIndex);
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.lockedEventIndex !== this.props.lockedEventIndex) {
      this._expandIfLockedEventIndexIsBelowThis(nextProps.lockedEventIndex);
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.eventIndex !== this.props.eventIndex) {
      throw new Error('eventIndex different in <InstrumentorStackedMapPoint shouldComponentUpdate>');
    }
    if (nextProps.fullLog !== this.props.fullLog) {
      throw new Error('fullLog different in <InstrumentorStackedMapPoint shouldComponentUpdate>');
    }
    if (nextProps.onSelectActive !== this.props.onSelectActive) {
      throw new Error('onSelectActive different in <InstrumentorStackedMapPoint shouldComponentUpdate>');
    }
    if (nextState.expanded !== this.state.expanded ||
        nextState.moreLinkHovering !== this.state.moreLinkHovering ||
        nextProps.searchFilter !== this.props.searchFilter) {
      return true;
    }
    if (this._normalizedSubEventIndex(nextProps.activeEventInCodeIndex) !==
        this._normalizedSubEventIndex(this.props.activeEventInCodeIndex)) {
      return true;
    }
    if (this._normalizedSubEventIndex(nextProps.lockedEventIndex) !==
        this._normalizedSubEventIndex(this.props.lockedEventIndex)) {
      return true;
    }
    return false;
  },

  componentDidMount() {
    this._scrollIntoViewIfNeeded();
  },

  componentDidUpdate() {
    this._scrollIntoViewIfNeeded();
  },

  _normalizedSubEventIndex(subEventIndex) {
    if (subEventIndex === null || subEventIndex < this.props.eventIndex ||
        subEventIndex > this._lastEventIndexBelowThis()) {
      return null;
    }

    return subEventIndex;
  },

  _lastEventIndexBelowThis() {
    const events = this.props.fullLog.events;
    let lastEventIndexBelowThis = this.props.eventIndex;
    let event = events[lastEventIndexBelowThis];
    while (event.nextStackingLevelEventIndices.length > 0) {
      lastEventIndexBelowThis =
        event.nextStackingLevelEventIndices[event.nextStackingLevelEventIndices.length - 1];
      event = events[lastEventIndexBelowThis];
    }

    this._lastEventIndexBelowThis = () => lastEventIndexBelowThis;
    return lastEventIndexBelowThis;
  },

  _expandIfLockedEventIndexIsBelowThis(lockedEventIndex) {
    const normalizedLockedEventIndex =
      this._normalizedSubEventIndex(lockedEventIndex);

    if (normalizedLockedEventIndex !== null &&
        normalizedLockedEventIndex !== this.props.eventIndex) {
      this.setState({ expanded: true });
    }
  },

  _scrollIntoViewIfNeeded() {
    if (this.props.eventIndex === this.props.lockedEventIndex) {
      if (document.body.scrollIntoViewIfNeeded) {
        React.findDOMNode(this).scrollIntoViewIfNeeded(true);
      }
    }
  },

  _handleMoreLinkMouseEnter() {
    this.setState({ moreLinkHovering: true });
  },

  _handleMoreLinkMouseLeave() {
    this.setState({ moreLinkHovering: false });
  },

  _handleBlockMouseEnter() {
    this.props.onSelectActive(this.props.eventIndex);
  },

  _handleMoreLinkClick(e) {
    e.stopPropagation();
    this.setState({ expanded: true });
  },

  _shouldShowSubEvents(subEvents) {
    return this.state.expanded || subEvents.length === 0 ||
      // this._eventsLeftInSubEvents(subEvents) < 15;
      this._eventsLeftInSubEvents(subEvents) < 5;
  },

  _eventsLeftInSubEvents(subEvents) {
    // .key is a hack
    return subEvents[subEvents.length - 1].key - this.props.eventIndex;
  },

  render() {
    const events = this.props.fullLog.events;
    const event = events[this.props.eventIndex];
    const subEvents = [];
    const activeEventInCodeIndex =
      this._normalizedSubEventIndex(this.props.activeEventInCodeIndex);
    const lockedEventIndex =
      this._normalizedSubEventIndex(this.props.lockedEventIndex);

    event.nextStackingLevelEventIndices.forEach(index => subEvents.push(
      <InstrumentorStackedMapPoint
        key={index}
        eventIndex={index}
        activeEventInCodeIndex={activeEventInCodeIndex}
        fullLog={this.props.fullLog}
        onSelectActive={this.props.onSelectActive}
        searchFilter={this.props.searchFilter}
        lockedEventIndex={lockedEventIndex}
      />
    ));

    const shouldShowSubEvents = this._shouldShowSubEvents(subEvents);
    const searchFilterRegex = new RegExp(this.props.searchFilter, 'i');

    let moreSearchResultsInSubEvents = false;
    if (this.props.searchFilter.length > 0 &&
        subEvents.length > 0 && !shouldShowSubEvents) {
      for (let index = event.index + 1; index <= this._lastEventIndexBelowThis(); index++) {
        if (searchFilterRegex.test(events[index].snippetName)) {
          moreSearchResultsInSubEvents = true;
          break;
        }
      }
    }

    const showEventInCodeGlow =
      activeEventInCodeIndex !== null && (
        activeEventInCodeIndex === this.props.eventIndex ||
        (!shouldShowSubEvents &&
          activeEventInCodeIndex > this.props.eventIndex &&
          activeEventInCodeIndex <= this._lastEventIndexBelowThis())
      );

    return (
      <div
        style={{
          display: 'inline-block',
          minWidth: 4,
          marginRight: 1,
          verticalAlign: 'top',
          cursor: shouldShowSubEvents ? 'default' : 'pointer',
        }}
      >
        <div
          style={{
            height: 5,
            background: stringToColor(event.snippetName, searchFilterRegex.test(
              event.snippetName) || moreSearchResultsInSubEvents ? 1 : 0.25),
            position: 'relative',
            marginBottom: 2,
            border: lockedEventIndex === this.props.eventIndex ?
              '1px solid black' : 'none',
            boxShadow: showEventInCodeGlow ? '0 0 5px 5px yellow' : '',
            zIndex: showEventInCodeGlow ? 1 : 0,
          }}
          onMouseEnter={this._handleBlockMouseEnter}
        />

        {shouldShowSubEvents &&
          <div style={{ marginLeft: 4, marginRight: -1 }}>
            {subEvents}
          </div>
        }
        {!shouldShowSubEvents &&
          <div
            style={{
              font: '10px/1 Helvetica',
              margin: '0 4px',
              color: moreSearchResultsInSubEvents ? '#000' : '#aaa',
              fontWeight: this.state.moreLinkHovering ? 'bold' : 'normal'
            }}
            onMouseEnter={this._handleMoreLinkMouseEnter}
            onMouseLeave={this._handleMoreLinkMouseLeave}
            onClick={this._handleMoreLinkClick}
          >
            {'+' + subEvents.length}
            {'/' + this._eventsLeftInSubEvents(subEvents)}
          </div>
        }
      </div>
    );
  },
});

const InstrumentorStackedMap = React.createClass({
  // propTypes: {
  //   activeEventInCodeIndex: PropTypes.number,
  //   fullLog: PropTypes.object.isRequired,
  //   onSelectActive: PropTypes.func.isRequired,
  //   lockedEventIndex: PropTypes.number,
  //   onToggleLock: PropTypes.func.isRequired,
  // },

  mixins: [
    PureRenderMixin,
  ],

  getInitialState() {
    return {
      searchFilter: '',
    };
  },

  render() {
    return (
      <div>
        <div>
          <input
            placeholder='Search…'
            onChange=
              {(event) => this.setState({ searchFilter: event.target.value})}
            value={this.state.searchFilter}
            style={{
              marginBottom: 12,
              width: '100%',
            }}
          />
        </div>
        <div
          style={{
            whiteSpace: 'nowrap',
            overflow: 'auto',
            width: '100%',
            minHeight: 100,
          }}
          onClick={this.props.onToggleLock}
        >
          {where(this.props.fullLog.events, { stackingLevel: 0 }).map(event =>
            <InstrumentorStackedMapPoint
              activeEventInCodeIndex={this.props.activeEventInCodeIndex}
              key={event.index}
              eventIndex={event.index}
              fullLog={this.props.fullLog}
              searchFilter={this.state.searchFilter}
              onSelectActive={this.props.onSelectActive}
              lockedEventIndex={this.props.lockedEventIndex}
            />
          )}
        </div>
      </div>
    );
  },
});

const InstrumentorOverview = React.createClass({
  // propTypes: {
  //   fullLog: PropTypes.object.isRequired,
  //   onClose: PropTypes.func.isRequired,
  // },

  mixins: [
    PureRenderMixin,
  ],

  getInitialState() {
    return {
      activeEventIndex: null,
      lockedEventIndex: null,
      activeEventInCodeIndex: null,
    };
  },

  _handleSelectActive(index) {
    this.setState({ activeEventIndex: index });
  },

  _handleToggleLock() {
    this.setState(state => state.lockedEventIndex === null ?
      { lockedEventIndex: state.activeEventIndex } : { lockedEventIndex: null }
    );
  },

  _handleSelectLockedCode(index) {
    this.setState({ activeEventIndex: index, lockedEventIndex: index });
  },

  _handleSelectActiveInCode(index) {
    this.setState({ activeEventInCodeIndex: index });
  },

  render() {
    let activeEvent =
      this.state.activeEventIndex !== null &&
      this.props.fullLog.events[this.state.activeEventIndex];

    if (this.state.lockedEventIndex !== null) {
      activeEvent = this.props.fullLog.events[this.state.lockedEventIndex];
    }

    const activeEventInCode =
      this.state.activeEventInCodeIndex &&
      this.props.fullLog.events[this.state.activeEventInCodeIndex];

    return (
      <div
        style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
          background: 'white', lineHeight: 0, padding: 20, overflow: 'auto',
          display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ lineHeight: 2 }}>
          <strong>Omniscient debugging </strong>
          <a onClick={this.props.onClose}>(close)</a>
        </div>
        <InstrumentorStackedMap
          activeEventInCodeIndex={this.state.activeEventInCodeIndex}
          fullLog={this.props.fullLog}
          lockedEventIndex={this.state.lockedEventIndex}
          onSelectActive={this._handleSelectActive}
          onToggleLock={this._handleToggleLock}
        />
        {activeEvent &&
          <InstrumentorCode
            activeEvent={activeEvent}
            activeEventInCode={activeEventInCode &&
              activeEventInCode.snippetName === activeEvent.snippetName &&
              activeEventInCode}
            snippetSplitByLines=
              {this.props.fullLog.snippetsSplitByLines[activeEvent.snippetName]}
            eventsInSnippet={this.props.fullLog.
              eventsBySnippet[activeEvent.snippetName]}
            key={this.props.fullLog.
              eventsBySnippet[activeEvent.snippetName].length}
            onSelectActiveInCode={this._handleSelectActiveInCode}
            onSelectLocked={this._handleSelectLockedCode}
          />
        }
      </div>
    );
  },
});

const InstrumentorSummary = React.createClass({
  getInitialState() {
    return {
      openedLog: null,
    };
  },

  componentDidMount() {
    setInterval(() => this.forceUpdate(), 100);
  },

  _handleOverviewClose() {
    this.setState({ openedLog: null });
  },

  render() {
    const fullLog = window.Instrumentor.getFullLog();

    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          bottom: 0,
          lineHeight: 0,
          cursor: 'pointer',
          zIndex: 1000000000000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div onClick={() => this.setState({ openedLog: fullLog })}>
          {fullLog.topLevelEvents.map(event =>
            <div
              key={event.index}
              style={{
                display: 'inline-block',
                height: 3,
                width: 3,
                background: stringToColor(event.snippetName),
              }}
            />
          )}
        </div>
        {this.state.openedLog &&
          <InstrumentorOverview
            fullLog={this.state.openedLog}
            onClose={this._handleOverviewClose}
          />
        }
      </div>
    );
  },
});

const Instrumentor = {
  _snippetsSplitByLines: {},
  _eventsBySnippet: {},
  _events: [],
  _eventIndexStack: [],
  _cachedFullLog: null,
  _topLevelEvents: [],

  addSnippet(name, snippet) {
    this._snippetsSplitByLines[name] = snippet.split('\n');
    this._eventsBySnippet[name] = [];
  },

  logStatement(snippetName, startLine, startColumn, endLine, endColumn, identifier, annotations) {
    const maxLine = this._snippetsSplitByLines[snippetName].length - 1;

    const event = {
      snippetName,
      annotations,
      identifier,
      time: new Date().toTimeString(),
      index: this._events.length,
      stackingLevel: this._eventIndexStack.length,
      startColumn, endColumn,
      // Clamp lines because they may be out of range because of function
      // wrapping in addInstrumentation.js.
      startLine: Math.max(0, Math.min(maxLine, startLine)),
      endLine: Math.max(0, Math.min(maxLine, endLine)),
      nextStackingLevelEventIndices: [],
    };
    this._events.push(event);
    this._eventsBySnippet[snippetName].push(event);
    if (event.stackingLevel > 0) {
      this._events[this._eventIndexStack[event.stackingLevel - 1]]
        .nextStackingLevelEventIndices.push(event.index);
    } else {
      this._topLevelEvents.push(event);
    }
  },

  logFunctionStart(snippetName, startLine, startColumn, endLine, endColumn, funcId, params) {
    const annotations = this._prettyFormatVariables(params);
    this.logStatement(snippetName, startLine, startColumn, endLine, endColumn,
      snippetName + ':' + funcId, annotations);
    this._eventIndexStack.push(this._events.length - 1);
  },

  logFunctionEnd(snippetName, startLine, startColumn, endLine, endColumn, funcId, result) {
    while (this._events[this._eventIndexStack[this._eventIndexStack.length - 1]]
             .identifier !== snippetName + ':' + funcId) {
      // probably an error was thrown somewhere
      const missedCall = this._events[this._eventIndexStack.pop()];

      const warning = 'Instrumentor.logFunctionEnd missed: ' +
        missedCall.snippetName + ':' + missedCall.startLine;
      const warningSnippetName = uniqueId('internalWarning');
      this.addSnippet(warningSnippetName, warning);
      this.logStatement(warningSnippetName, 0, 0, 0, 0);
      window.console.warn(warning);
    }
    this._eventIndexStack.pop();
    return result;
  },

  logError(error) {
    const errorSnippetName = uniqueId('error');
    this.addSnippet(errorSnippetName, error.stack);
    this.logStatement(errorSnippetName, 0, 0, 0, 0);

    window.console.error('Instrumentor found error (possibly caught):', error);
    throw error;
  },

  getFullLog() {
    if (!this._cachedFullLog ||
        this._cachedFullLog.events.length !== this._events.length) {
      this._cachedFullLog = {
        snippetsSplitByLines: this._snippetsSplitByLines,
        events: this._events,
        eventsBySnippet: this._eventsBySnippet,
        topLevelEvents: this._topLevelEvents,
      };
    }
    return this._cachedFullLog;
  },

  _prettyFormatValue(value) {
    if (value === undefined) {
      return 'undefined';
    } else if (value === null) {
      return 'null';
    }

    const type = typeof value;
    switch (type) {
      case 'string':
        if (value.length > 43) {
          return JSON.stringify(value.substring(0, 40) + '...');
        } else {
          return JSON.stringify(value);
        }
        break;
      case 'object':
        try {
          return JSON.stringify(value);
        } catch (e) {
          return '[object]';
        }
        break;
      case 'function':
        return `[function ${value.name}]`;
      default:
        return JSON.stringify(value);
    }
  },

  _prettyFormatVariables(variables) {
    if (!variables) {
      return;
    }

    return Object.keys(variables).map(
      key => key + ': ' + this._prettyFormatValue(variables[key])).join(', ');
  },
};

if (!window.Instrumentor) {
  // window.Instrumentor is accessible to any code, but you're not supposed to
  // call functions on it. Instead use window.instrumentCodeGroup (see below).
  window.Instrumentor = Instrumentor;

  window.instrumentCodeGroup = (name, description='', callback=null) => {
    const snippetName = 'window.instrumentCodeGroup(' + name + ')';
    window.Instrumentor.addSnippet(snippetName, description);

    if (callback) {
      window.Instrumentor.logFunctionStart(snippetName, 0, 0, 0, 0, 0);
      window.Instrumentor.logFunctionEnd(snippetName, 0, 0, 0, 0, 0, callback());
    } else {
      window.Instrumentor.logStatement(snippetName, 0, 0, 0, 0);
    }
  }

  // Only use specifically when wrapping a top-level call, because otherwise
  // asynchronism doesn't work.
  window.instrumentCodeGroupAsyncTopLevel = (name, description, callback) => {
    const snippetName = 'window.instrumentCodeGroupAsync(' + name + ')';
    window.Instrumentor.addSnippet(snippetName, description);

    window.Instrumentor.logFunctionStart(snippetName, 0, 0, 0, 0, 0);
    const result = callback();
    window.setTimeout(() => window.Instrumentor
      .logFunctionEnd(snippetName, 0, 0, 0, 0, 0, result), 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    React.render(<InstrumentorSummary/>, container);
  });
}
