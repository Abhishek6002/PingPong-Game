using UnityEngine;

public class TestLaunch : MonoBehaviour
{
    public Rigidbody ballRb;
    public Ball ballScript;
    public Vector3 initialVelocity = new Vector3(8f, 2f, 0f);
    public Vector3 initialAngularVelocity = new Vector3(20f, 0f, 0f); // radians/sec

    void Start()
    {
        if (ballRb == null) ballRb = GetComponent<Rigidbody>();
        if (ballScript == null) ballScript = GetComponent<Ball>();
    }

    void Update()
    {
        // Press Space to launch/reset
        if (Input.GetKeyDown(KeyCode.Space))
        {
            ballRb.velocity = initialVelocity;
            ballScript.angularVelocity = initialAngularVelocity;
            ballRb.position = new Vector3(0f, 1.0f, 0f); // adjust start position
            ballRb.angularVelocity = Vector3.zero; // Unity angular velocity separate from our script's angularVelocity
        }
    }
}
