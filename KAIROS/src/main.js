import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import App from './App.jsx'
import './style.css'

createRoot(document.getElementById('app')).render(createElement(App))

