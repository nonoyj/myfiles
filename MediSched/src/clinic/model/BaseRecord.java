package clinic.model;

/**
 * ABSTRACTION: Abstract class that defines a contract.
 * Any class that extends this MUST implement getSummary() and validate().
 * Nobody can instantiate BaseRecord directly — they must use a subclass.
 */
public abstract class BaseRecord {

    // Abstract methods — subclasses MUST override these
    // This is ABSTRACTION. we define what to do, not how
    public abstract String getSummary();
    public abstract void validate();
}