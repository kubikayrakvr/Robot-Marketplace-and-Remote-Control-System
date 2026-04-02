function RegisterForm({ onSubmit }) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Ad Soyad
        <input type="text" name="fullName" autoComplete="name" required />
      </label>
      <label>
        E-posta
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label>
        Şifre
        <input type="password" name="password" autoComplete="new-password" required />
      </label>
      <label>
        Şifre (tekrar)
        <input type="password" name="passwordConfirm" autoComplete="new-password" required />
      </label>
      <button type="submit" className="primary-button full-width">
        Kayıt ol
      </button>
    </form>
  );
}

export default RegisterForm;
