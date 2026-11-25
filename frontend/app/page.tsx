import SceneLoader from '@/components/SceneLoader'
import Hangar from '@/components/Hangar'
import ContactForm from '@/components/ContactForm'
import Nav from '@/components/Nav'
import Fx from '@/components/Fx'
import { Footer, Hero, Journey, Marquee, Routes } from '@/components/Sections'

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="backdrop" aria-hidden="true" />
      <SceneLoader />
      <div className="veil" aria-hidden="true" />
      <Nav />
      <main id="main">
        <Hero />
        <Marquee />
        <Routes />
        <Hangar />
        <Journey />
        <ContactForm />
      </main>
      <Footer />
      <Fx />
    </>
  )
}
