import React from 'react'
import ReactDOM from 'react-dom/client'
import Options from './options'
import './options.css'

// options.htmlの<div id="options-root">にReactアプリをマウント
ReactDOM.createRoot(document.getElementById('options-root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
)