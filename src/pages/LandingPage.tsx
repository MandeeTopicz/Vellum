import { useNavigate } from 'react-router-dom'
import StickyNote from '../components/landing/StickyNote'
import Footer from '../components/landing/Footer'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()

  function scrollToAbout() {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-page gradient-background">
      <nav className="landing-nav">
        <span className="landing-logo-wrap">
          <img src="/letter-v.png" alt="" className="vellum-logo-icon" aria-hidden />
          <span className="landing-logo">Vellum</span>
        </span>
        <div className="landing-nav-actions">
          <button type="button" className="landing-nav-btn" onClick={scrollToAbout}>
            About
          </button>
          <button
            type="button"
            className="landing-nav-btn"
            onClick={() => navigate('/login')}
            data-testid="login-btn"
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
            data-testid="get-started-btn"
          >
            Get Started
          </button>
          <p className="landing-hero-subtext">
            Canvas-first planning with a clean, collaborative experience.
          </p>
        </section>

        {/* About Section - SCOPED TO LANDING PAGE ONLY (not whiteboard) */}
        <section id="about" className="landing-about about-section">
          <h2 className="landing-about-title">About</h2>
          <div className="sticky-grid">
            <StickyNote
              title="About Vellum"
              content="Vellum is a collaborative board for turning rough ideas to real plans—fast. It combines a flexible whiteboard with smart, structured templates so teams can brainstorm, organize, and move forward without friction."
              color="#67AAF9"
              className="sticky-blue-1"
            />
            <StickyNote
              title="What it's for"
              content={[
                'Project kickoffs and planning',
                'Kanban workflows',
                'Retrospectives',
                'Brainstorms and workshops',
              ]}
              color="#2EC0F9"
              className="sticky-cyan"
            />
            <StickyNote
              title="How it helps"
              content={[
                'Clean, organized templates generated from your prompt',
                'Fast editing with a focused tool layout',
                'Shareable structure that keeps teams aligned',
                'Stays lightweight and responsive',
              ]}
              color="#9BBDF9"
              className="sticky-blue-2"
            />
            <StickyNote
              title="Teams & Collaborators"
              content="Vellum is built for teams who need to think, plan, and build together—without friction. Share boards instantly, collaborate in real time, and keep ideas, decisions, and action items in one organized workspace. Whether you're brainstorming or executing, everyone stays aligned."
              color="#C4E0F9"
              className="sticky-blue-3"
            />
            <StickyNote
              title="Students"
              content="Designed for group projects, study sessions, and presentations, Vellum helps students work together visually and efficiently. Guided templates make it easy to turn rough ideas into structured plans, while real-time collaboration keeps everyone contributing and accountable."
              color="#B388EB"
              className="sticky-purple"
            />
            <StickyNote
              title="Educators"
              content="Vellum supports collaborative learning through shared boards for lessons, workshops, and group activities. Educators can guide students with structured layouts while still allowing creativity, participation, and discussion—whether in person or remote."
              color="#F7AEF8"
              className="sticky-pink"
            />
          </div>
          <div className="max-w-3xl mx-auto mt-16">
            <StickyNote
              title="The Vision"
              content="A whiteboard should feel like a workspace, not a blank void. Vellum's goal is to guide people into the right structure at the right time—without getting in the way."
              color="#67AAF9"
              className="sticky-blue-1 vision-note"
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
