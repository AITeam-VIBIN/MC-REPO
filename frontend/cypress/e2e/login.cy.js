describe('Authentication Flow', () => {
  it('should load login page and allow login with valid credentials', () => {
    cy.visit('/');
    const email = Cypress.env('TEST_ADMIN_EMAIL') || 'ankita.agarwal@mitconindia.com';
    const password = Cypress.env('TEST_ADMIN_PASSWORD') || 'Ankita0207@10841';
    cy.get('#email').type(email);
    cy.get('#password').type(password);
    cy.get('button[type="submit"]').click();
    
    // Check that we logged in successfully by confirming layout elements
    cy.contains('Terminate Session', { timeout: 15000 });
  });
});
