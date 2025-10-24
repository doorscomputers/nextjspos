# Page snapshot

```yaml
- generic [ref=e1]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - img [ref=e6]
    - generic [ref=e10]:
      - heading "Welcome Back" [level=2] [ref=e11]
      - paragraph [ref=e12]: Login to your InventorySystem
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Username
        - textbox "Username" [active] [ref=e16]: superadmin
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: Password
          - link "Forgot Your Password?" [ref=e20] [cursor=pointer]:
            - /url: "#"
        - generic [ref=e21]:
          - textbox "Password" [ref=e22]: password
          - button [ref=e23]:
            - img [ref=e24]
      - generic [ref=e27]:
        - checkbox "Remember Me" [ref=e28]
        - generic [ref=e29]: Remember Me
      - button "Login" [ref=e30]
  - alert [ref=e31]
```