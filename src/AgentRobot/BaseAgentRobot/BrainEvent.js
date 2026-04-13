class BrainEvent {
  static THINK_BEFORE = '1'
  static SUB_THINK_BEFORE = '1.1'
  static SUB_THINK_AFTER = '1.2'
  static SUB_STREAM_THINK_OUTPUT = '1.3'
  static SUB_STREAM_CONTENT_OUTPUT = '1.4'
  static SUB_STREAM_TOOL_CALLS_OUTPUT = '1.5'
  static SUB_STREAM_END = '1.6'
  static SUB_USE_TOOL = '1.7'
  static SUB_THINK_ERROR = '1.8'
  static COMPRESS_MESSAGES_BEFORE = '1.9'
  static COMPRESS_MESSAGES_AFTER = '1.10'
  static NEW_MESSAGE = '1.11'
  static THINK_AFTER = '2'
}

module.exports = BrainEvent