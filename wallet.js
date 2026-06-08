// ══════════════════════════════════════════════════════
//  AppToChain — Wallet Connect Module
//  Supports: MetaMask, Coinbase Wallet, WalletConnect
//  Works on all pages — just include this script
// ══════════════════════════════════════════════════════

const SUPPORTED_NETWORKS = {
  1:     { name: 'Ethereum',  symbol: 'ETH',   explorer: 'https://etherscan.io' },
  8453:  { name: 'Base',      symbol: 'ETH',   explorer: 'https://basescan.org' },
  56:    { name: 'BNB Chain', symbol: 'BNB',   explorer: 'https://bscscan.com' },
  137:   { name: 'Polygon',   symbol: 'MATIC',  explorer: 'https://polygonscan.com' },
  42161: { name: 'Arbitrum',  symbol: 'ETH',   explorer: 'https://arbiscan.io' },
  10:    { name: 'Optimism',  symbol: 'ETH',   explorer: 'https://optimistic.etherscan.io' },
  43114: { name: 'Avalanche', symbol: 'AVAX',  explorer: 'https://snowtrace.io' },
}

window.WalletState = {
  address: null,
  chainId: null,
  balance: null,
  provider: null,
  connected: false,
}

// ── Load saved session ──────────────────────────────
function loadWalletSession() {
  try {
    const saved = localStorage.getItem('atc_wallet_session')
    if (saved) {
      const s = JSON.parse(saved)
      if (s.address && Date.now() - s.timestamp < 86400000) { // 24hr expiry
        WalletState.address = s.address
        WalletState.chainId = s.chainId
        WalletState.connected = true
        updateAllWalletUIs()
        return true
      }
    }
  } catch(e) {}
  return false
}

function saveWalletSession() {
  localStorage.setItem('atc_wallet_session', JSON.stringify({
    address: WalletState.address,
    chainId: WalletState.chainId,
    timestamp: Date.now()
  }))
}

function clearWalletSession() {
  localStorage.removeItem('atc_wallet_session')
  WalletState.address = null
  WalletState.chainId = null
  WalletState.balance = null
  WalletState.connected = false
  updateAllWalletUIs()
}

// ── Format helpers ──────────────────────────────────
function shortAddr(addr) {
  return addr ? addr.slice(0,6) + '…' + addr.slice(-4) : ''
}

function getNetworkName(chainId) {
  return SUPPORTED_NETWORKS[chainId]?.name || 'Unknown Network'
}

// ── Connect MetaMask ────────────────────────────────
async function connectMetaMask() {
  if (typeof window.ethereum === 'undefined') {
    showWalletModal('nomm')
    return
  }
  try {
    setWalletLoading(true)
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
    const chainId = parseInt(chainIdHex, 16)
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest']
    })

    WalletState.address = accounts[0]
    WalletState.chainId = chainId
    WalletState.balance = (parseInt(balance, 16) / 1e18).toFixed(4)
    WalletState.connected = true
    WalletState.provider = 'metamask'

    saveWalletSession()
    updateAllWalletUIs()
    closeWalletModal()
    showToast('✓ MetaMask connected: ' + shortAddr(accounts[0]), 'success')

    // Listen for account/chain changes
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) { disconnectWallet(); return }
      WalletState.address = accounts[0]
      saveWalletSession()
      updateAllWalletUIs()
    })
    window.ethereum.on('chainChanged', (chainIdHex) => {
      WalletState.chainId = parseInt(chainIdHex, 16)
      saveWalletSession()
      updateAllWalletUIs()
      showToast('Network changed to ' + getNetworkName(WalletState.chainId), 'info')
    })

  } catch(e) {
    if (e.code === 4001) showToast('Connection cancelled', 'error')
    else showToast('MetaMask error: ' + e.message, 'error')
  } finally {
    setWalletLoading(false)
  }
}

// ── Switch Network ──────────────────────────────────
async function switchNetwork(chainId) {
  if (!window.ethereum) return
  const chainHex = '0x' + chainId.toString(16)
  const networkParams = {
    8453:  { chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] },
    56:    { chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org'], blockExplorerUrls: ['https://bscscan.com'] },
    137:   { chainName: 'Polygon', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://polygon-rpc.com'], blockExplorerUrls: ['https://polygonscan.com'] },
    42161: { chainName: 'Arbitrum One', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://arb1.arbitrum.io/rpc'], blockExplorerUrls: ['https://arbiscan.io'] },
    10:    { chainName: 'Optimism', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.optimism.io'], blockExplorerUrls: ['https://optimistic.etherscan.io'] },
  }
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] })
  } catch(e) {
    if (e.code === 4902 && networkParams[chainId]) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainHex, ...networkParams[chainId] }] })
    }
  }
}

// ── Disconnect ──────────────────────────────────────
function disconnectWallet() {
  clearWalletSession()
  showToast('Wallet disconnected', 'info')
}

// ── Update all wallet UI elements on page ──────────
function updateAllWalletUIs() {
  const { connected, address, chainId, balance } = WalletState

  // Update all connect buttons
  document.querySelectorAll('[data-wallet-btn]').forEach(btn => {
    if (connected) {
      btn.textContent = shortAddr(address)
      btn.style.background = 'rgba(34,197,94,0.1)'
      btn.style.borderColor = 'rgba(34,197,94,0.3)'
      btn.style.color = '#22c55e'
      btn.onclick = showWalletInfo
    } else {
      btn.textContent = 'Connect Wallet'
      btn.style.background = ''
      btn.style.borderColor = ''
      btn.style.color = ''
      btn.onclick = showWalletModal
    }
  })

  // Update network badges
  document.querySelectorAll('[data-wallet-network]').forEach(el => {
    el.textContent = connected ? getNetworkName(chainId) : '—'
  })

  // Update address displays
  document.querySelectorAll('[data-wallet-address]').forEach(el => {
    el.textContent = connected ? shortAddr(address) : 'Not connected'
  })

  // Update balance displays
  document.querySelectorAll('[data-wallet-balance]').forEach(el => {
    el.textContent = connected ? (balance || '0') + ' ' + (SUPPORTED_NETWORKS[chainId]?.symbol || 'ETH') : '—'
  })
}

// ── Loading state ───────────────────────────────────
function setWalletLoading(on) {
  document.querySelectorAll('[data-wallet-btn]').forEach(btn => {
    btn.disabled = on
    if (on) btn.textContent = 'Connecting…'
  })
}

// ── WALLET MODAL ────────────────────────────────────
function injectWalletModal() {
  if (document.getElementById('wallet-modal-bg')) return

  const css = `
  #wallet-modal-bg{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px;font-family:'Inter',-apple-system,sans-serif}
  #wallet-modal-bg.open{display:flex}
  #wallet-modal{background:#0a0a0a;border:1px solid #2a2a2a;border-radius:16px;width:100%;max-width:380px;overflow:hidden}
  #wm-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1e1e1e}
  #wm-head h3{font-size:15px;font-weight:700;color:#ededed;margin:0}
  #wm-close{background:none;border:none;cursor:pointer;color:#666;font-size:20px;line-height:1;padding:2px 6px}
  #wm-close:hover{color:#ededed}
  #wm-body{padding:16px}
  .wm-btn{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:#111;border:1px solid #2a2a2a;border-radius:10px;cursor:pointer;margin-bottom:10px;transition:all 0.15s;font-family:inherit}
  .wm-btn:hover{border-color:#444;background:#161616}
  .wm-btn-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  .wm-btn-info{text-align:left}
  .wm-btn-name{font-size:14px;font-weight:600;color:#ededed;display:block}
  .wm-btn-desc{font-size:11px;color:#666;display:block;margin-top:2px}
  .wm-btn-arrow{margin-left:auto;color:#444;font-size:16px}
  #wm-nomm{display:none;padding:16px;text-align:center}
  #wm-nomm p{font-size:13px;color:#a1a1a1;margin-bottom:14px;line-height:1.6}
  #wm-nomm a{display:inline-block;padding:10px 20px;background:#f6851b;border-radius:8px;color:white;text-decoration:none;font-weight:700;font-size:13px}
  #wm-info{display:none;padding:16px}
  .wm-addr-box{background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:12px 14px;margin-bottom:12px}
  .wm-addr-label{font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px}
  .wm-addr-val{font-size:13px;font-family:monospace;color:#ededed;word-break:break-all}
  .wm-net-row{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;gap:6px}
  .wm-net-chip{height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #2a2a2a;background:#111;color:#a1a1a1;transition:all 0.1s;font-family:inherit}
  .wm-net-chip:hover{border-color:#3b82f6;color:#3b82f6;background:rgba(59,130,246,0.08)}
  .wm-net-chip.active{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,0.08)}
  .wm-disconnect{width:100%;height:36px;background:transparent;border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s}
  .wm-disconnect:hover{background:rgba(239,68,68,0.08)}
  #toast-container{position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .toast{background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;padding:11px 16px;font-size:13px;color:#ededed;font-family:'Inter',-apple-system,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:toastin 0.25s ease;max-width:320px;pointer-events:all}
  .toast.success{border-color:rgba(34,197,94,0.3);color:#22c55e}
  .toast.error{border-color:rgba(239,68,68,0.3);color:#ef4444}
  .toast.info{border-color:rgba(37,99,235,0.3);color:#60a5fa}
  @keyframes toastin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  `

  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)

  const html = `
  <div id="wallet-modal-bg">
    <div id="wallet-modal">
      <div id="wm-head">
        <h3 id="wm-title">Connect Wallet</h3>
        <button id="wm-close" onclick="closeWalletModal()">×</button>
      </div>

      <div id="wm-body">
        <button class="wm-btn" onclick="connectMetaMask()">
          <div class="wm-btn-icon" style="background:#fff3e6">🦊</div>
          <div class="wm-btn-info">
            <span class="wm-btn-name">MetaMask</span>
            <span class="wm-btn-desc">Connect using browser extension</span>
          </div>
          <span class="wm-btn-arrow">›</span>
        </button>
        <button class="wm-btn" onclick="connectCoinbase()">
          <div class="wm-btn-icon" style="background:#e6eeff">🔵</div>
          <div class="wm-btn-info">
            <span class="wm-btn-name">Coinbase Wallet</span>
            <span class="wm-btn-desc">Connect using Coinbase Wallet</span>
          </div>
          <span class="wm-btn-arrow">›</span>
        </button>
        <button class="wm-btn" onclick="connectBrowserWallet()">
          <div class="wm-btn-icon" style="background:#f0f0f0">💼</div>
          <div class="wm-btn-info">
            <span class="wm-btn-name">Browser Wallet</span>
            <span class="wm-btn-desc">Any injected web3 wallet</span>
          </div>
          <span class="wm-btn-arrow">›</span>
        </button>
      </div>

      <div id="wm-nomm">
        <p>MetaMask is not installed.<br>Install it to connect your wallet.</p>
        <a href="https://metamask.io/download/" target="_blank">Install MetaMask →</a>
      </div>

      <div id="wm-info">
        <div class="wm-addr-box">
          <div class="wm-addr-label">Connected Address</div>
          <div class="wm-addr-val" id="wm-addr-val">—</div>
        </div>
        <div class="wm-addr-box">
          <div class="wm-addr-label">Balance</div>
          <div class="wm-addr-val" id="wm-bal-val">—</div>
        </div>
        <div class="wm-addr-label" style="margin-bottom:8px">Switch Network</div>
        <div class="wm-net-row" id="wm-net-row"></div>
        <button class="wm-disconnect" onclick="disconnectWallet();closeWalletModal()">Disconnect Wallet</button>
      </div>
    </div>
  </div>
  <div id="toast-container"></div>
  `

  document.body.insertAdjacentHTML('beforeend', html)
  document.getElementById('wallet-modal-bg').addEventListener('click', e => {
    if (e.target === document.getElementById('wallet-modal-bg')) closeWalletModal()
  })
}

function showWalletModal(mode) {
  injectWalletModal()
  const bg = document.getElementById('wallet-modal-bg')
  const body = document.getElementById('wm-body')
  const nomm = document.getElementById('wm-nomm')
  const info = document.getElementById('wm-info')
  const title = document.getElementById('wm-title')

  body.style.display = 'block'
  nomm.style.display = 'none'
  info.style.display = 'none'

  if (mode === 'nomm') {
    body.style.display = 'none'
    nomm.style.display = 'block'
    title.textContent = 'Install MetaMask'
  } else {
    title.textContent = 'Connect Wallet'
  }
  bg.classList.add('open')
}

function showWalletInfo() {
  injectWalletModal()
  const bg = document.getElementById('wallet-modal-bg')
  const body = document.getElementById('wm-body')
  const nomm = document.getElementById('wm-nomm')
  const info = document.getElementById('wm-info')
  const title = document.getElementById('wm-title')

  body.style.display = 'none'
  nomm.style.display = 'none'
  info.style.display = 'block'
  title.textContent = 'Wallet Connected'

  document.getElementById('wm-addr-val').textContent = WalletState.address || '—'
  document.getElementById('wm-bal-val').textContent = WalletState.balance
    ? WalletState.balance + ' ' + (SUPPORTED_NETWORKS[WalletState.chainId]?.symbol || 'ETH')
    : '—'

  // Network chips
  const row = document.getElementById('wm-net-row')
  row.innerHTML = ''
  Object.entries(SUPPORTED_NETWORKS).forEach(([id, net]) => {
    const chip = document.createElement('button')
    chip.className = 'wm-net-chip' + (WalletState.chainId == id ? ' active' : '')
    chip.textContent = net.name
    chip.onclick = () => switchNetwork(parseInt(id))
    row.appendChild(chip)
  })

  bg.classList.add('open')
}

function closeWalletModal() {
  const bg = document.getElementById('wallet-modal-bg')
  if (bg) bg.classList.remove('open')
}

async function connectCoinbase() {
  if (window.ethereum?.isCoinbaseWallet) {
    await connectMetaMask()
  } else if (window.ethereum) {
    await connectMetaMask()
  } else {
    window.open('https://www.coinbase.com/wallet/downloads', '_blank')
  }
}

async function connectBrowserWallet() {
  if (window.ethereum) await connectMetaMask()
  else showToast('No web3 wallet detected in your browser', 'error')
}

// ── Toast notifications ─────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  injectWalletModal()
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  toast.className = 'toast ' + type
  toast.textContent = msg
  container.appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}

// ── Auto init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectWalletModal()
  loadWalletSession()

  // Auto-reconnect MetaMask if previously connected
  if (WalletState.connected && window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0 && accounts[0].toLowerCase() === WalletState.address?.toLowerCase()) {
        window.ethereum.request({ method: 'eth_chainId' }).then(hex => {
          WalletState.chainId = parseInt(hex, 16)
          updateAllWalletUIs()
        })
      }
    }).catch(() => {})
  }
})
