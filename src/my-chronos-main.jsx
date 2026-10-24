import React from 'react'
import ReactDOM from 'react-dom/client'
import MemoryPage from './MemoryPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <MemoryPage mine />
    </LangProvider>
  </React.StrictMode>,
)
