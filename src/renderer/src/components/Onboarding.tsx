import { Icon } from './Icon'

interface OnboardingProps {
  onPickFolder: () => void
}

export function Onboarding({ onPickFolder }: OnboardingProps): React.JSX.Element {
  return (
    <div className="onboard">
      <div className="onboard-card">
        <Icon name="cube" size={32} />
        <h1>Welcome to the Redux Launcher</h1>
        <p>
          Before we start, pick the folder where your GTA V is installed (the one that contains{' '}
          <code>GTA5.exe</code>). Reduxes will be installed into that folder and we&apos;ll keep a
          backup of every file we replace so you can revert any time.
        </p>
        <button className="btn primary" onClick={onPickFolder} style={{ width: '100%' }}>
          <Icon name="folder" /> Pick GTA folder
        </button>
      </div>
    </div>
  )
}
