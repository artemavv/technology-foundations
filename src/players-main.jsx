import React from 'react'
import ReactDOM from 'react-dom/client'
import PlayersPage from './PlayersPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <PlayersPage />
    </LangProvider>
  </React.StrictMode>,
)
