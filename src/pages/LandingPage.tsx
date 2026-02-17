import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()

  function scrollToAbout() {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <span className="landing-logo">Vellum</span>
        <div className="landing-nav-actions">
          <button type="button" className="landing-nav-btn" onClick={scrollToAbout}>
            About
          </button>
          <button
            type="button"
            className="landing-nav-btn"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
          <button
            type="button"
            className="landing-nav-btn landing-nav-btn-primary"
            onClick={() => navigate('/login')}
          >
            Sign Up
          </button>
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <h1 className="landing-hero-title">
            From rough ideas to real plans.
          </h1>
          <button
            type="button"
            className="landing-hero-cta"
            onClick={() => navigate('/login')}
          >
            Get Started
          </button>
          <p className="landing-hero-subtext">
            Canvas-first planning with a clean, collaborative experience.
          </p>
        </section>

        <section id="about" className="landing-about">
          <h2 className="landing-about-title">About</h2>
          <p className="landing-about-content">Under construction</p>
        </section>
      </main>
    </div>
  )
}
