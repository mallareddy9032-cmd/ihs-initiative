import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Doctor Studio root element #root was not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Doctor Studio">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
