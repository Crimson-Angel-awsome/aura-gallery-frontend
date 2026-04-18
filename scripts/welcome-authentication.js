const form = document.querySelector('form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const toggleIcon = document.querySelector('.input-wrap svg');

if (toggleIcon && passwordInput) {
  toggleIcon.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleIcon.setAttribute('fill', isHidden ? '#4f46e5' : '#e3e3e3');
  });
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email) {
      alert('Please enter your email address.');
      emailInput.focus();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      alert('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    if (!password) {
      alert('Please enter your password.');
      passwordInput.focus();
      return;
    }

    alert('Login submitted successfully!');
    form.reset();
    passwordInput.type = 'password';
  });
}
