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
      <label>
        Güvenlik Sorusu
        <select name="securityQuestion" required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: '#020617', border: '1px solid #1e293b', color: '#fff', marginBottom: '1rem' }}>
          <option value="İlk evcil hayvanınızın adı nedir?">İlk evcil hayvanınızın adı nedir?</option>
          <option value="Annenizin kızlık soyadı nedir?">Annenizin kızlık soyadı nedir?</option>
          <option value="Hangi şehirde doğdunuz?">Hangi şehirde doğdunuz?</option>
          <option value="En sevdiğiniz çocukluk arkadaşınızın adı nedir?">En sevdiğiniz çocukluk arkadaşınızın adı nedir?</option>
          <option value="İlk okulunuzun adı nedir?">İlk okulunuzun adı nedir?</option>
        </select>
      </label>
      <label>
        Güvenlik Sorusu Cevabı
        <input type="text" name="securityAnswer" required placeholder="Cevabınızı girin" />
      </label>
      <button type="submit" className="primary-button full-width">
        Kayıt ol
      </button>
    </form>
  );
}

export default RegisterForm;
