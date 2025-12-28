/**
 * Represents an Amper project template.
 */
export interface AmperTemplate {
    /**
     * The template identifier used with `amper init <id>`
     */
    id: string;

    /**
     * Human-readable name of the template
     */
    label: string;

    /**
     * Description of what the template creates
     */
    description: string;
}

/**
 * Default templates extracted from Amper source code.
 * These are used as fallback when dynamic discovery fails.
 * 
 * Source: vendor/amper/sources/amper-project-templates/resources/messages/ProjectTemplatesBundle.properties
 */
export const DEFAULT_TEMPLATES: AmperTemplate[] = [
    {
        id: 'compose-android',
        label: 'Android application (Jetpack Compose)',
        description: 'An Android application using Jetpack Compose for its UI'
    },
    {
        id: 'compose-desktop',
        label: 'JVM GUI application (Compose Multiplatform)',
        description: 'A JVM application using Compose Multiplatform for Desktop for its UI'
    },
    {
        id: 'compose-ios',
        label: 'iOS application (Compose Multiplatform)',
        description: 'An iOS application using Compose Multiplatform for iOS for its UI'
    },
    {
        id: 'compose-multiplatform',
        label: 'Compose Multiplatform application',
        description: 'A KMP project with Android, iOS, and JVM desktop applications sharing UI with Compose Multiplatform'
    },
    {
        id: 'jvm-cli',
        label: 'JVM console application',
        description: 'A plain JVM console application without any framework'
    },
    {
        id: 'kmp-lib',
        label: 'Kotlin Multiplatform library',
        description: 'A multiplatform library targeting Android, iOS, and the JVM'
    },
    {
        id: 'ktor-server',
        label: 'Ktor server application',
        description: 'A Ktor server application with the Netty engine'
    },
    {
        id: 'multiplatform-cli',
        label: 'Multiplatform CLI application',
        description: 'A multiplatform CLI application targeting the JVM, as well as Linux, macOS, and Windows native targets'
    },
    {
        id: 'spring-boot-java',
        label: 'Spring Boot application (Java)',
        description: 'A Spring Boot application written in Java'
    },
    {
        id: 'spring-boot-kotlin',
        label: 'Spring Boot application (Kotlin)',
        description: 'A Spring Boot application written in Kotlin'
    }
];
