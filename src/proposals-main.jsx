import React from 'react'
import ReactDOM from 'react-dom/client'
import ProposalsPage from './ProposalsPage.jsx'
import { LangProvider } from './i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <ProposalsPage />
    </LangProvider>
  </React.StrictMode>,
)
