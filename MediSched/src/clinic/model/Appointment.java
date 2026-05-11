package clinic.model;
import clinic.model.Person;

public class Appointment extends Person {

    // These fields belong only to Appointment, not Person
    private String phone;
    private String date;
    private String time;
    private String reason;
    private String status;

    public static final String STATUS_PENDING   = "Pending...";
    public static final String STATUS_APPROVED  = "Approved!";
    public static final String STATUS_COMPLETED = "Completed.";
    public static final String STATUS_CANCELLED = "Cancelled.";

    // ── Constructor ───────────────────────────────────────────────────────────
    public Appointment(String name, String phone, String date,
                       String time, String reason, String status) {
        super(name); // INHERITANCE: parent handles name + phone
        setPhone(phone);
        setDate(date);
        setTime(time);
        setReason(reason);
        setStatus(status);
    }

    // ── Getters ───────────────────────────────────────────────────────────────
    public String getPhone()     { return phone; }
    public String getDate()   { return date; }
    public String getTime()   { return time; }
    public String getReason() { return reason; }
    public String getStatus() { return status; }

    // ── Setters with validation ───────────────────────────────────────────────
   
    public void setPhone(String phone) {
        if (phone == null || phone.trim().isEmpty())
            throw new IllegalArgumentException("Phone number cannot be empty.");
        if (!phone.trim().matches("\\+?[0-9]{7,15}"))
            throw new IllegalArgumentException("Phone number must be 7-15 digits only.");
        this.phone = phone.trim();
    }
    
    public void setDate(String date) {
        if (date == null || date.trim().isEmpty())
            throw new IllegalArgumentException("Date cannot be empty.");
        this.date = date.trim();
    }

    public void setTime(String time) {
        if (time == null || time.trim().isEmpty())
            throw new IllegalArgumentException("Time cannot be empty.");
        this.time = time.trim();
    }

    public void setReason(String reason) {
        if (reason == null || reason.trim().isEmpty())
            throw new IllegalArgumentException("Reason cannot be empty.");
        this.reason = reason.trim();
    }

    public void setStatus(String status) {
        if (!status.equals(STATUS_PENDING)   &&
            !status.equals(STATUS_APPROVED)  &&
            !status.equals(STATUS_COMPLETED) &&
            !status.equals(STATUS_CANCELLED))
            throw new IllegalArgumentException("Invalid status: " + status);
        this.status = status;
    }

    @Override
    public void validate() {
        // This is called before saving to DB
        if (getName() == null || phone == null ||
            date == null || time == null ||
            reason == null || status == null) {
            throw new IllegalStateException("All appointment fields are required.");
        }
    }

    // ── POLYMORPHISM: Appointment's own version of getSummary() ───────────────
    @Override
    public String getSummary() {
        return "[Appointment] Patient: " + getName() +
               " | Phone: " + phone +
               " | Date: " + date + " at " + time +
               " | Reason: " + reason +
               " | Status: " + status;
    }
}