# Linear Algebra Primer

Linear algebra provides the mathematical foundation for machine learning, computer graphics, and data analysis. This primer covers the core concepts you need to work effectively with vectors and matrices.

## Vectors

A vector is an ordered list of numbers representing a point or direction in space. Vectors have both magnitude (length) and direction. In ML contexts, vectors typically represent features or data points in high-dimensional space.

Two vectors can be added component-wise, producing a new vector. Scalar multiplication scales each component. The **dot product** of two vectors yields a single number: multiply corresponding components and sum results. The dot product equals the product of magnitudes times the cosine of the angle between them.

## Matrices

A matrix is a rectangular array of numbers arranged in rows and columns. An m×n matrix has m rows and n columns. Matrices represent linear transformations—functions that preserve vector addition and scalar multiplication.

Matrix multiplication combines rows of the first matrix with columns of the second. The element at position (i,j) in the product equals the dot product of row i from the first matrix and column j from the second. Matrix multiplication is not commutative: AB typically differs from BA.

## Matrix Operations

**Transpose** flips a matrix across its diagonal. The element at (i,j) in the original moves to (j,i) in the transpose.

**Identity matrix** I has ones on the diagonal and zeros elsewhere. Multiplying any matrix by I leaves it unchanged: AI = IA = A.

**Inverse** A⁻¹ of matrix A satisfies AA⁻¹ = A⁻¹A = I. Only square matrices with non-zero determinants have inverses. The inverse provides a way to solve linear systems.

## Linear Systems

Linear equations in matrix form: Ax = b, where A contains coefficients, x is the unknown vector, and b is the output. When A is invertible, the unique solution is x = A⁻¹b.

In ML, we often solve systems where no exact solution exists—overdetermined cases with more equations than unknowns. We instead find the **least squares solution** that minimizes the squared error.

## Eigenvalues and Eigenvectors

For square matrix A, eigenvector v and eigenvalue λ satisfy Av = λv. The eigenvector represents a direction unchanged by the transformation (except scaling). The eigenvalue is that scaling factor.

Eigenvalues matter enormously in practice. Principal Component Analysis uses eigenvectors of the covariance matrix to identify the directions of maximum variance in data. Spectral methods use eigenvalues to analyze graph structure and clustering.

## Practical Applications

Recommendation systems multiply user and item matrices to predict preferences. Image processing applies transformation matrices for rotation, scaling, and filtering. Neural networks store weights in matrices and perform repeated matrix-vector multiplications during forward and backward propagation.

Understanding these fundamentals will make the mathematical operations in ML algorithms clear and intuitive.