using UnityEngine;

/// <summary>
/// Attach to the ball (with a Rigidbody).
/// Models spin as angular velocity (omega). Applies Magnus force F = magnusCoeff * (omega x v).
/// On collision with paddle, apply tangential impulse and modify angular velocity on paddle hits.
/// </summary>
[RequireComponent(typeof(Rigidbody))]
public class Ball : MonoBehaviour
{
    Rigidbody rb;

    // Spin (angular velocity in rad/s). Use local space axis where Y is "top spin" axis, etc.
    public Vector3 angularVelocity = Vector3.zero;

    [Header("Magnus / Spin flight")]
    public float magnusCoefficient = 0.02f; // scales Magnus force
    public float maxMagnusForce = 10f;

    [Header("Spin decay")]
    public float spinDecayRate = 0.5f; // per second
    public float minSpinThreshold = 0.01f;

    [Header("Collision spin response")]
    public float contactSpinMultiplier = 5f; // how much spin imparted from paddle contact
    public float tangentialFriction = 0.2f; // how tangential velocity at contact affects bounce

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        rb.maxAngularVelocity = 1000f;
    }

    void FixedUpdate()
    {
        ApplyMagnusEffect();
        ApplySpinDecay();
        // Optionally rotate visual ball to match angularVelocity
        transform.Rotate(angularVelocity * Mathf.Rad2Deg * Time.fixedDeltaTime, Space.Self);
    }

    void ApplyMagnusEffect()
    {
        Vector3 v = rb.velocity;
        if (v.sqrMagnitude < 1e-6f || angularVelocity.sqrMagnitude < 1e-6f) return;

        // Magnus force: F = k * (omega x v)
        Vector3 magnus = magnusCoefficient * Vector3.Cross(angularVelocity, v);

        // Clamp for stability
        if (magnus.magnitude > maxMagnusForce)
            magnus = magnus.normalized * maxMagnusForce;

        rb.AddForce(magnus, ForceMode.Force);
    }

    void ApplySpinDecay()
    {
        float decayFactor = Mathf.Clamp01(1f - spinDecayRate * Time.fixedDeltaTime);
        angularVelocity *= decayFactor;
        if (angularVelocity.magnitude < minSpinThreshold) angularVelocity = Vector3.zero;
    }

    void OnCollisionEnter(Collision collision)
    {
        // Detect if we hit a paddle (by tag or component)
        var paddle = collision.gameObject.GetComponent<Paddle>();
        if (paddle != null)
        {
            // Contact point and paddle velocity at contact
            ContactPoint cp = collision.GetContact(0);
            Vector3 contactPoint = cp.point;
            Vector3 contactNormal = cp.normal; // points from collider into this (roughly)
            Vector3 paddleVel = paddle.GetVelocityAtPoint(contactPoint);

            // Compute relative contact position on paddle plane (local X/Y) to get "where" we hit
            // We interpret offset along paddle's local X to induce side spin, local Z for top/bottom spin (approx).
            Vector3 localPoint = paddle.transform.InverseTransformPoint(contactPoint);

            // Impart spin: spin delta proportional to local offset and paddle lateral velocity
            // Example: hit near top/back -> backspin (around local X), hit near side -> sidespin (around local Z)
            Vector3 spinDelta = Vector3.zero;
            spinDelta += paddle.transform.right * (-localPoint.y) * contactSpinMultiplier; // side spin from vertical offset
            spinDelta += paddle.transform.forward * (localPoint.x) * contactSpinMultiplier; // top/back spin from horizontal offset

            // Also use paddle's tangential velocity to add spin (e.g., sliding paddle)
            Vector3 tangential = Vector3.ProjectOnPlane(paddleVel, contactNormal);
            spinDelta += Vector3.Cross(contactNormal, tangential) * 0.5f;

            // Convert spinDelta from world-space impulse-like to angular velocity change (rad/s)
            angularVelocity += spinDelta;

            // Modify bounce by tangential friction: apply impulse that adjusts linear velocity based on tangential velocity at contact
            // Compute ball tangential velocity at contact due to spin: v_t = omega x r (r = contact offset from center)
            Vector3 r = contactPoint - transform.position;
            Vector3 ballTangential = Vector3.Cross(angularVelocity, r);

            // Remove/modify tangential component of ball velocity to simulate friction at contact
            Vector3 v = rb.velocity;
            Vector3 normalComponent = Vector3.Project(v, contactNormal);
            Vector3 tangentialComponent = v - normalComponent;

            Vector3 adjustedTangential = tangentialComponent + ballTangential * tangentialFriction;
            rb.velocity = normalComponent + adjustedTangential;

            // Optionally apply small impulse along contactNormal to keep consistent bounce (Unity already handles restitution)
            // rb.AddForce(contactNormal * 0.1f, ForceMode.VelocityChange);
        }

        // You might add special handling for table collisions to convert spin into lateral bounce too.
    }
}
