import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import AdminPage from './admin'
import { AwwwardsHero } from './components/awwwards/AwwwardsHero'
import { ConfigProvider } from './ConfigContext'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/entrega" element={<App />} />
        <Route path="/master" element={<App />} />
        <Route path="/admin" element={<App />} />
        <Route path="/admin/:password" element={<AdminPage />} />
        <Route path="/hero3d" element={<ConfigProvider><AwwwardsHero /></ConfigProvider>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
