const React = require('react/addons');
const { uniqueId, where } = require('underscore');
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

const InstrumentorCode = React.createClass({
  propTypes: {
    snippetSplitByLines: PropTypes.array.isRequired,
    activeEvent: PropTypes.shape({
      annotations: PropTypes.string,
      snippetName: PropTypes.string.isRequired,
      index: PropTypes.number.isRequired,
      startLine: PropTypes.number.isRequired,
      startColumn: PropTypes.number.isRequired,
      endLine: PropTypes.number.isRequired,
      endColumn: PropTypes.number.isRequired,
    }).isRequired,
    eventsInSnippet: PropTypes.array.isRequired,
  },

  mixins: [
    PureRenderMixin,
  ],

  getInitialState() {
    return {
      internalLocalEventIndex: null,
    };
  },

  componentDidMount() {
    this._scrollToFirstLine();

    this._columnWidth = React.findDOMNode(
      this.refs.hiddenMeasuringDiv).clientWidth / 100;
    // Refresh after first mount since we didn't have _columnWidth yet.
    setTimeout(() => this.forceUpdate());
  },

  componentDidUpdate() {
    this._scrollToFirstLine();
  },

  _scrollToFirstLine() {
    if (this.refs.file && this.refs.firstLine) {
      const fileElement = React.findDOMNode(this.refs.file);
      const firstLineElement = React.findDOMNode(this.refs.firstLine);

      fileElement.scrollTop =
        firstLineElement.offsetTop - fileElement.clientHeight / 2;
    }
    if (this.refs.events && this.refs.activeEvent) {
      const eventsElement = React.findDOMNode(this.refs.events);
      const activeEventElement = React.findDOMNode(this.refs.activeEvent);

      eventsElement.scrollLeft =
        activeEventElement.offsetLeft - eventsElement.clientWidth / 2;
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
    let eventLeftPosition = 500;

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
            {this.state.internalLocalEventIndex !== null &&
              this._renderHighlights('yellow',
                this.props.eventsInSnippet[this.state.internalLocalEventIndex])}
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
              </div>
            )}
            <div
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                overflowX: 'scroll' }}
              ref='events'
            >
              {this.props.eventsInSnippet.map((event, localIndex) => {
                eventLeftPosition += 3;

                const nextEvent = this.props.eventsInSnippet[localIndex + 1];
                if (nextEvent && nextEvent.index > event.index + 1) {
                  eventLeftPosition += 3 +
                    Math.max(12, Math.round((nextEvent.index - event.index) / 1000));
                }

                let background = 'rgba(0,0,0,0.07)';
                if (localIndex === this.state.internalLocalEventIndex) {
                  background = 'yellow';
                } else if (event.index === this.props.activeEvent.index) {
                  background = 'orange';
                }

                return (
                  <div
                    key={event.index}
                    style={{
                      width: 3,
                      height: 15 * (event.endLine - event.startLine + 1),
                      position: 'absolute',
                      left: eventLeftPosition,
                      top: 15 * event.startLine,
                      background,
                    }}
                    ref={event.index === this.props.activeEvent.index &&
                      'activeEvent'}
                    onMouseEnter={() =>
                      this.setState({ internalLocalEventIndex: localIndex })}
                    onMouseLeave={() =>
                      this.setState({ internalLocalEventIndex: null })}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  },
});

const InstrumentorStackedMapPoint = React.createClass({
  propTypes: {
    eventIndex: PropTypes.number.isRequired,
    fullLog: PropTypes.object.isRequired,
    onSelectActive: PropTypes.func.isRequired,
    searchFilter: PropTypes.string.isRequired,
    lockedEventIndex: PropTypes.number,
  },

  mixins: [
    PureRenderMixin,
  ],

  getInitialState() {
    return {
      expanded: false,
      moreLinkeHovering: false,
    };
  },

  _handleMoreLinkMouseEnter() {
    this.setState({ moreLinkeHovering: true });
  },

  _handleMoreLinkMouseLeave() {
    this.setState({ moreLinkeHovering: false });
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
      this._eventsLeftInSubEvents(subEvents) < 15;
  },

  _eventsLeftInSubEvents(subEvents) {
    // .key is a hack
    return subEvents[subEvents.length - 1].key - this.props.eventIndex;
  },

  render() {
    const events = this.props.fullLog.events;
    const event = events[this.props.eventIndex];
    const subEvents = [];

    for (let index = event.index + 1; index < events.length; index++) {
      const subEvent = events[index];

      if (subEvent.stackingLevel <= event.stackingLevel) {
        break;
      }

      if (subEvent.stackingLevel === event.stackingLevel + 1) {
        subEvents.push(
          <InstrumentorStackedMapPoint
            {...this.props}
            key={index}
            eventIndex={index}
          />
        );
      }
    }

    const shouldShowSubEvents = this._shouldShowSubEvents(subEvents);
    const searchFilterRegex = new RegExp(this.props.searchFilter, 'i');

    let moreSearchResultsInSubEvents = false;
    if (this.props.searchFilter.length > 0 &&
        subEvents.length > 0 && !shouldShowSubEvents) {
      // .key is still a hack here...
      for (let index = event.index + 1;
          index <= subEvents[subEvents.length - 1].key; index++) {
        if (searchFilterRegex.test(events[index].snippetName)) {
          moreSearchResultsInSubEvents = true;
          break;
        }
      }
    }

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
            border: this.props.lockedEventIndex === this.props.eventIndex ?
              '1px solid black' : 'none',
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
              fontWeight: this.state.moreLinkeHovering ? 'bold' : 'normal'
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
  propTypes: {
    fullLog: PropTypes.object.isRequired,
    onSelectActive: PropTypes.func.isRequired,
    lockedEventIndex: PropTypes.number,
    onToggleLock: PropTypes.func.isRequired,
  },

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
  propTypes: {
    fullLog: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
  },

  mixins: [
    PureRenderMixin,
  ],

  getInitialState() {
    return {
      activeEventIndex: null,
      lockedEventIndex: null,
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

  render() {
    let activeEvent =
      this.state.activeEventIndex !== null &&
      this.props.fullLog.events[this.state.activeEventIndex];

    if (this.state.lockedEventIndex !== null) {
      activeEvent = this.props.fullLog.events[this.state.lockedEventIndex];
    }

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
          fullLog={this.props.fullLog}
          lockedEventIndex={this.state.lockedEventIndex}
          onSelectActive={this._handleSelectActive}
          onToggleLock={this._handleToggleLock}
        />
        {activeEvent &&
          <InstrumentorCode
            activeEvent={activeEvent}
            snippetSplitByLines=
              {this.props.fullLog.snippetsSplitByLines[activeEvent.snippetName]}
            eventsInSnippet={this.props.fullLog.
              eventsBySnippet[activeEvent.snippetName]}
            key={this.props.fullLog.
              eventsBySnippet[activeEvent.snippetName].length}
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
          {fullLog.events
            .filter(event => event.stackingLevel === 0)
            .map(event =>
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
  _stackingSnippetNameAndLine: [],
  _cachedFullLog: null,

  addSnippet(name, snippet) {
    this._snippetsSplitByLines[name] = snippet.split('\n');
    this._eventsBySnippet[name] = [];
  },

  logStatement(snippetName, startLine, startColumn, endLine, endColumn, annotations) {
    const maxLine = this._snippetsSplitByLines[snippetName].length - 1;

    const event = {
      snippetName,
      annotations,
      time: new Date().toTimeString(),
      index: this._events.length,
      stackingLevel: this._stackingSnippetNameAndLine.length,
      startColumn, endColumn,
      // Clamp lines because they may be out of range because of function
      // wrapping in addInstrumentation.js.
      startLine: Math.max(0, Math.min(maxLine, startLine)),
      endLine: Math.max(0, Math.min(maxLine, endLine)),
    };
    this._events.push(event);
    this._eventsBySnippet[snippetName].push(event);
  },

  logFunctionStart(snippetName, startLine, startColumn, endLine, endColumn, params) {
    const annotations = this._prettyFormatVariables(params);
    this.logStatement(snippetName, startLine, startColumn, endLine, endColumn, annotations);
    this._stackingSnippetNameAndLine.push(snippetName + ':' + startLine);
  },

  logFunctionEnd(snippetName, startLine, startColumn, endLine, endColumn, result) {
    while (this._stackingSnippetNameAndLine[this.
        _stackingSnippetNameAndLine.length - 1] !== snippetName + ':' + startLine) {
      // probably an error was thrown somewhere
      const missedCall = this._stackingSnippetNameAndLine.pop();
      window.console.warn('Instrumentor.logFunctionEnd missed: ' + missedCall);
    }
    this._stackingSnippetNameAndLine.pop();
    return result;
  },

  logError(error) {
    const errorSnippetName = uniqueId('error');
    this.addSnippet(errorSnippetName, error.stack);
    this.logStatement(errorSnippetName, 0);

    throw error;
  },

  getFullLog() {
    if (!this._cachedFullLog ||
        this._cachedFullLog.events.length !== this._events.length) {
      this._cachedFullLog = {
        snippetsSplitByLines: this._snippetsSplitByLines,
        events: this._events,
        eventsBySnippet: this._eventsBySnippet,
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
  window.Instrumentor = Instrumentor;

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    React.render(<InstrumentorSummary/>, container);
  });
}
