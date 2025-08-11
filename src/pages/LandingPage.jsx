import { Phone, MessageSquare } from 'lucide-react';
import './LandingPage.css'; // Import the new CSS

function LandingPage() {
  const whatsappNumber = "919154381054";
  const whatsappMessage = "Hello Interval! I'm interested in a demo for my business.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="landing-page">
      {/* --- Hero Section with Video --- */}
      <section className="hero-section">
        <video className="video-background" autoPlay loop muted playsInline key={Date.now()}>
          <source src="/background-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="video-overlay"></div>
        <div className="hero-content">
          <h1>The Effortless Way to Order.</h1>
          <p>
            From theatre seats to cafe tables, Interval empowers your customers to order and pay with a simple QR scan.
          </p>
          <a href="#contact" className="cta-button">
            Request a Demo
          </a>
        </div>
      </section>

      {/* --- How It Works Section --- */}
      <section className="page-section">
        <h2 className="section-title">It's as easy as 1-2-3</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 className="step-title">Scan</h3>
            <p className="step-description">Guests scan a unique QR code at their seat or table. No app download is ever required.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3 className="step-title">Order & Pay</h3>
            <p className="step-description">They browse your digital menu, select items, and pay instantly and securely via Razorpay.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3 className="step-title">Serve</h3>
            <p className="step-description">You receive the order in real-time on your Pantry Dashboard. Prepare and serve with a smile.</p>
          </div>
        </div>
      </section>

      {/* --- Contact & Pricing Section --- */}
      <section id="contact" className="page-section contact-section">
        <h2 className="section-title">Ready to Boost Your Business?</h2>
        <div className="contact-card">
          <h3>Launch Partner Offer</h3>
          <p>Contact us today to learn about our exclusive, discounted offer for our first 10 partners.</p>
          <div className="contact-info">
            <Phone size={20} />
            <span>Call us at: +91 9154381054</span>
          </div>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="cta-button whatsapp-button">
            <MessageSquare size={20} />
            Chat on WhatsApp
          </a>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-logo">Interval</p>
          <p>&copy; 2025 Interval Technologies. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;