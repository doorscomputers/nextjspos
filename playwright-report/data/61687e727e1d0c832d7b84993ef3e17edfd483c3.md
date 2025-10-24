# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - img [ref=e6]
    - generic [ref=e10]:
      - heading "Welcome Back" [level=2] [ref=e11]
      - paragraph [ref=e12]: Login to your InventorySystem
    - generic [ref=e13]:
      - paragraph [ref=e15]: "Login failed: Invalid credentials"
      - generic [ref=e16]:
        - generic [ref=e17]: Username
        - textbox "Username" [ref=e18]: superadmin
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Password
          - link "Forgot Your Password?" [ref=e22] [cursor=pointer]:
            - /url: "#"
        - generic [ref=e23]:
          - textbox "Password" [ref=e24]: password
          - button [ref=e25]:
            - img [ref=e26]
      - generic [ref=e29]:
        - checkbox "Remember Me" [ref=e30]
        - generic [ref=e31]: Remember Me
      - button "Login" [ref=e32]
  - alert [ref=e33]
```