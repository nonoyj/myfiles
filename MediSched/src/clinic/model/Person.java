package clinic.model;

/**
 * INHERITANCE: Person extends BaseRecord.
 * ABSTRACTION: Still abstract — cannot be instantiated directly.
 */
public abstract class Person extends BaseRecord {
    
    private String name;

    public Person(String name) {
        setName(name);
    }
    
   public String getName()  { return name; }

    public void setName(String name) {
        if (name == null || name.trim().isEmpty())
            throw new IllegalArgumentException("Name cannot be empty.");
        this.name = name.trim();
    }

    

    @Override
    public String toString() {
        return "Person{name='" + name + "'}";
    }
}