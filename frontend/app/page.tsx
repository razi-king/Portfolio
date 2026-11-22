import SceneLoader from '@/components/SceneLoader'
import Hangar from '@/components/Hangar'
import ContactForm from '@/components/ContactForm'
import { Footer, Hero, Journey, Nav, Routes } from '@/components/Sections'

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <SceneLoader />
      <div className="veil" aria-hidden="true" />
      <Nav />
      <main id="main">
        <Hero />
        <Routes />
        <Hangar />
        <Journey />
        <ContactForm />
      </main>
      <Footer />
    </>
  )
}
