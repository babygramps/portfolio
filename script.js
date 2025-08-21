// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Year
  const yearElement = document.getElementById('y');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Mobile Menu Functionality
  const hamburgerBtn = document.querySelector('.hamburger-btn');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  const closeBtn = document.querySelector('.close-btn');
  const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');

  function openMobileMenu() {
    if (hamburgerBtn && mobileMenuOverlay) {
      hamburgerBtn.classList.add('active');
      mobileMenuOverlay.classList.add('active');
      hamburgerBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      console.log('Mobile menu opened'); // Debug log
    }
  }

  function closeMobileMenu() {
    if (hamburgerBtn && mobileMenuOverlay) {
      hamburgerBtn.classList.remove('active');
      mobileMenuOverlay.classList.remove('active');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = ''; // Restore scrolling
      console.log('Mobile menu closed'); // Debug log
    }
  }

  // Event listeners
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Hamburger button clicked'); // Debug log
      openMobileMenu();
    });
    console.log('Hamburger button found and event listener added'); // Debug log
  } else {
    console.log('Hamburger button not found'); // Debug log
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMobileMenu);
  }

  // Close menu when clicking on overlay background
  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', (e) => {
      if (e.target === mobileMenuOverlay) {
        closeMobileMenu();
      }
    });
  }

  // Close menu when clicking on navigation links
  mobileMenuLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenuOverlay && mobileMenuOverlay.classList.contains('active')) {
      closeMobileMenu();
    }
  });
});

// Scroll reveal
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  })
}, { threshold: .18 });
document.querySelectorAll('.reveal').forEach(el => { if (!el.classList.contains('in')) io.observe(el) });

// Enable flip on tap for touch devices (including photo card)
document.querySelectorAll('[data-flip]').forEach(el => {
  el.addEventListener('touchstart', () => el.classList.toggle('flipped'), { passive: true });
});

// Handle contact form submission
document.querySelector('.contact-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  console.log('🚀 Form submission started');

  const submitBtn = this.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  // Prevent double submission
  if (submitBtn.disabled) {
    console.log('⚠️ Form already being submitted, ignoring');
    return;
  }

  // Check if reCAPTCHA is completed
  const recaptchaResponse = grecaptcha.getResponse();
  if (!recaptchaResponse) {
    showNotification('Please complete the reCAPTCHA verification.', 'error');
    return;
  }

  // Show loading state
  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';

  // Convert FormData to regular object for JSON
  const formData = new FormData(this);
  const data = {};
  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  // Add reCAPTCHA response
  data['g-recaptcha-response'] = recaptchaResponse;

  console.log('📝 Form data:', data);

  try {
    console.log('📡 Sending request to /contact...');

            const response = await fetch('https://k4jp7upqmcfmchbj35jb3jlojq0civky.lambda-url.us-west-1.on.aws/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    console.log('📨 Response received:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('📋 Response data:', result);

    if (result.success) {
      // Show success message
      console.log('✅ Success! Showing success state');
      submitBtn.textContent = 'Message Sent!';
      submitBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      submitBtn.style.opacity = '1';

      // Create and show success notification
      showNotification('Message sent successfully! Rick will get back to you soon.', 'success');

      // Reset form and reCAPTCHA
      this.reset();
      grecaptcha.reset();

      // Reset button after 3 seconds
      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.style.background = '';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }, 3000);
    } else {
      throw new Error(result.message || 'Unknown error occurred');
    }
  } catch (error) {
    console.error('❌ Error occurred:', error);

    // Reset reCAPTCHA on error
    grecaptcha.reset();

    // Show error notification with specific message if available
    let errorMessage = 'Error sending message. Please try again.';
    if (error.message.includes('reCAPTCHA has expired')) {
      errorMessage = 'reCAPTCHA has expired. Please complete it again and resubmit.';
    } else if (error.message.includes('reCAPTCHA')) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Error sending message. Opening email client as backup...';

      // Fallback to email client only for non-reCAPTCHA errors
      const name = data.name;
      const email = data.email;
      const company = data.company;
      const project = data.project;
      const message = data.message;

      const subject = `Project Inquiry from ${name}${company ? ` (${company})` : ''}`;
      const body = `Name: ${name}
Email: ${email}
${company ? `Company: ${company}` : ''}
${project ? `Project Type: ${project}` : ''}

Message:
${message}`;

      const mailtoLink = `mailto:richardarothbart@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      setTimeout(() => {
        window.location.href = mailtoLink;
      }, 2000);
    }

    showNotification(errorMessage, 'error');

    // Reset button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.background = '';
  }
});

// Notification system
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    z-index: 1000;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    ${type === 'success' ? 'background: linear-gradient(135deg, #22c55e, #16a34a);' : ''}
    ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626);' : ''}
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);

  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}