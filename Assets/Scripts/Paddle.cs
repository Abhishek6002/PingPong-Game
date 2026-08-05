using UnityEngine;

/// <summary>
/// Simple paddle example. Attach to paddle object.
/// Provide method GetVelocityAtPoint so Ball can sample paddle motion when colliding.
/// For simplicity, this uses Rigidbody velocity and an optional hand-tweak to influence spin.
/// </summary>
[RequireComponent(typeof(Rigidbody))]
public class Paddle : MonoBehaviour
{
    Rigidbody rb;

    // Extra spin multiplier when player intentionally "brushes" the ball (optional)
    public float playerSpinIntentMultiplier = 1.0f;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
    }

    // Returns approximate velocity at a specific world-space point on this paddle.
    public Vector3 GetVelocityAtPoint(Vector3 worldPoint)
    {
        // If paddle is rigidbody, we can estimate point velocity = rb.velocity + omega x r
        Vector3 r = worldPoint - rb.worldCenterOfMass;
        Vector3 pointVel = rb.velocity + Vector3.Cross(rb.angularVelocity, r);

        // Optionally multiply if player input indicates a brushing motion for extra spin
        // (You could add logic here to detect swipe/gesture and raise multiplier)
        return pointVel * playerSpinIntentMultiplier;
    }

    // Example helper: if you want to actively apply a spin gesture from player code:
    public void ApplySpinGesture(Vector3 spinAxis, float spinAmount)
    {
        rb.AddTorque(spinAxis.normalized * spinAmount, ForceMode.VelocityChange);
    }
}
