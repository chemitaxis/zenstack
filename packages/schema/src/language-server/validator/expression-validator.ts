import { BinaryExpr, Expression, isBinaryExpr, isEnum } from '@zenstackhq/language/ast';
import { ValidationAcceptor } from 'langium';
import { isAuthInvocation } from '../../utils/ast-utils';
import { AstValidator } from '../types';

/**
 * Validates expressions.
 */
export default class ExpressionValidator implements AstValidator<Expression> {
    validate(expr: Expression, accept: ValidationAcceptor): void {
        // deal with a few cases where reference resolution fail silently
        if (!expr.$resolvedType) {
            if (isAuthInvocation(expr)) {
                // check was done at link time
                accept('error', 'auth() cannot be resolved because no "User" model is defined', { node: expr });
            } else if (this.isCollectionPredicate(expr)) {
                accept('error', 'collection predicate can only be used on an array of model type', { node: expr });
            } else {
                accept('error', 'expression cannot be resolved', {
                    node: expr,
                });
            }
        }

        if (expr.$resolvedType?.decl === 'Unsupported') {
            accept('error', 'Field of "Unsupported" type cannot be used in expressions', { node: expr });
        }

        // extra validations by expression type
        switch (expr.$type) {
            case 'BinaryExpr':
                this.validateBinaryExpr(expr, accept);
                break;
        }
    }

    private validateBinaryExpr(expr: BinaryExpr, accept: ValidationAcceptor) {
        switch (expr.operator) {
            case 'in': {
                if (typeof expr.left.$resolvedType?.decl !== 'string' && !isEnum(expr.left.$resolvedType?.decl)) {
                    accept('error', 'left operand of "in" must be of scalar type', { node: expr.left });
                }

                if (!expr.right.$resolvedType?.array) {
                    accept('error', 'right operand of "in" must be an array', {
                        node: expr.right,
                    });
                }
                break;
            }
        }
    }

    private isCollectionPredicate(expr: Expression) {
        return isBinaryExpr(expr) && ['?', '!', '^'].includes(expr.operator);
    }
}
