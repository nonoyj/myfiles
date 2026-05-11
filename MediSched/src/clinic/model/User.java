package clinic.model;   

/**
 * INHERITANCE: User extends Person.
 * POLYMORPHISM: getSummary() behaves differently than Appointment's version.
 * ABSTRACTION: Implements all abstract methods required by BaseRecord.
 */
public class User extends Person {
    
    private String username;
    private String password;

    public User(String name, String username, String password) {
        super(name); // INHERITANCE
        setUsername(username);
        setPassword(password);
    }
    
    public String getUsername() { return username; }
    public String getPassword() { return password; }
    
    public void setUsername(String username) {
        if (username == null || username.trim().isEmpty())
            throw new IllegalArgumentException("Username cannot be empty.");
        this.username = username.trim();
    }

    public void setPassword(String password) {
        if (password == null || password.length() < 6)
            throw new IllegalArgumentException("Password must be at least 6 characters.");
        this.password = password;
    }

    // ── ABSTRACTION: required by BaseRecord ───────────────────────────────────
    @Override
    public void validate() {
        if (username == null || password == null)
            throw new IllegalStateException("Username and password are required.");
    }

    // ── POLYMORPHISM: different output than Appointment.getSummary() ──────────
    @Override
    public String getSummary() {
        return "[User] Name: " + getName() +
               " | Username: " + username;
    }

    @Override
    public String toString() {
        return "User{username='" + username + "', " + super.toString() + '}';
    }
}