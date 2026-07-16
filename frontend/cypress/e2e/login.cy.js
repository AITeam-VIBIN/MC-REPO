describe('Authentication Flow', () => {
  it('should load login page and allow login with valid credentials', () => {
    cy.visit('/');
    cy.get('#email').type('ankita.agarwal@mitconindia.com');
    cy.get('#password').type('Ankita0207@10841');
    cy.get('button[type="submit"]').click();
    
    // Check that we logged in successfully by confirming layout elements
    cy.contains('Terminate Session', { timeout: 15000 });
  });
});
