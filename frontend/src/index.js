import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css'; // Global Design System
import './styles/layout.css';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
