import React from 'react'
import ReactDOM from 'react-dom/client'
import LoginPage from './LoginPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <LoginPage />
    </LangProvider>
  </React.StrictMode>,
)
