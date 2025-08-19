// Integration test setup - handles both Node.js database and React components

// Configure jsdom for React component testing in Node environment  
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>');

// Set up globals for React and testing
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.HTMLAnchorElement = window.HTMLAnchorElement;
global.HTMLButtonElement = window.HTMLButtonElement;
global.HTMLInputElement = window.HTMLInputElement;

// Required for React Testing Library
import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Make fetch available globally for Node.js tests
if (typeof global.fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Add Node.js globals needed for PostgreSQL
if (!global.TextEncoder) {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock console for cleaner test output
const originalConsole = console;
global.console = {
  ...console,
  log: jest.fn(), // Mock chatty logs
  debug: jest.fn(),
  info: jest.fn(),
  error: originalConsole.error, // Keep errors visible
  warn: originalConsole.warn, // Keep warnings visible
};