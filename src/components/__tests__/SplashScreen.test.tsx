import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SplashScreen from '../SplashScreen'

describe('SplashScreen', () => {
  it('renders splash screen with logo and title', () => {
    render(<SplashScreen />)

    expect(screen.getByTestId('splash-screen')).toBeInTheDocument()
    expect(screen.getByTestId('splash-logo')).toBeInTheDocument()
    expect(screen.getByText('PCR Manager')).toBeInTheDocument()
  })

  it('renders with full opacity by default', () => {
    const { container } = render(<SplashScreen />)
    const splashDiv = screen.getByTestId('splash-screen')

    expect(splashDiv).toHaveClass('opacity-100')
    expect(splashDiv).not.toHaveClass('opacity-0')
  })

  it('applies opacity-0 class when fadingOut is true', () => {
    const { container } = render(<SplashScreen fadingOut={true} />)
    const splashDiv = screen.getByTestId('splash-screen')

    expect(splashDiv).toHaveClass('opacity-0')
    expect(splashDiv).not.toHaveClass('opacity-100')
  })
})
